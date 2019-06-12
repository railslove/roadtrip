import util from 'util'
import path from 'path'
import fs from 'fs'
import AWS from 'aws-sdk'
import s3diff from 's3-diff'
import mime from 'mime-types'
import { getCacheControl } from './cache-control'

const debug = require('debug')('roadtrip:lib:s3')
const s3 = new AWS.S3({ apiVersion: '2006-03-01' })
const BUCKET_CACHE_TAG = 'roadtrip_cache_hash'

export async function exists(projectName) {
  try {
    await s3.headBucket({ Bucket: projectName }).promise()
    return true
  } catch (error) {
    if (error.code !== 'NotFound') {
      // NotFound means the bucket name can be claimed. Other errors could include
      // permission errors. This error has all infos the user needs.
      debug('s3.headBucket unexpected error: %s', error.code)
      throw error
    }

    debug('Bucket does not yet exist and name is available.')
    return false
  }
}

export async function create(projectName) {
  const ACL = 'public-read'
  debug('Create bucket %s', projectName)
  return s3.createBucket({ ACL, Bucket: projectName }).promise()
}

export async function website(projectName, { indexFile, errorFile }) {
  const config = {
    WebsiteConfiguration: {
      IndexDocument: { Suffix: indexFile },
      ErrorDocument: { Key: errorFile }
    }
  }

  debug('Update bucket %s: %O', projectName, config)
  return s3
    .putBucketWebsite({
      Bucket: projectName,
      ...config
    })
    .promise()
}

export async function sync(
  projectName,
  syncDir,
  { onUpdate, cacheControlRules, forceAll = true } = {}
) {
  // diff between local and remote
  const actions = await util.promisify(s3diff)({
    local: syncDir,
    remote: { bucket: projectName },
    recursive: true,
    globOpts: { dot: false }
  })
  debug(
    'Diff between bucket %s and local %s: %O',
    projectName,
    syncDir,
    actions
  )

  const syncs = [
    ...actions.changed.map(file => ({ file, type: 'update' })),
    ...(forceAll ? actions.keep.map(file => ({ file, type: 'update' })) : []), // forceAll: also update non-changed files, e.g. when headers were changed
    ...actions.extra.map(file => ({ file, type: 'create' })),
    ...actions.missing.map(file => ({ file, type: 'delete' }))
  ]

  for (let { file, type } of syncs) {
    const fullFilePath = path.resolve(syncDir, file)
    onUpdate(type, file)

    let params
    switch (type) {
      case 'update':
      case 'create':
        params = {
          Bucket: projectName,
          Body: fs.readFileSync(fullFilePath),
          Key: file,
          ACL: 'public-read',
          ContentType: mime.lookup(fullFilePath) || undefined,
          CacheControl: getCacheControl(file, cacheControlRules)
        }
        debug('s3.putObject: %O', params)
        await s3.putObject(params).promise()
        break
      case 'delete':
        params = {
          Bucket: projectName,
          Key: file
        }
        debug('s3.deleteObject: %O', params)
        await s3.deleteObject(params).promise()
        break
      default: // intentionally left blank
    }
  }

  return syncs
}

export async function getRegion(projectName) {
  const { LocationConstraint: region } = await s3
    .getBucketLocation({ Bucket: projectName })
    .promise()
  debug('Bucket %s region: %s', projectName, region)
  return region || 'us-east-1' // aws returns an empty string if region is us-east-1
}

export async function getCacheHash(projectName) {
  const value = await getTag(projectName, BUCKET_CACHE_TAG)
  return value
}

export async function setCacheHash(projectName, hash) {
  return setTag(projectName, BUCKET_CACHE_TAG, hash)
}

export async function getTag(projectName, tagKey) {
  debug('Get bucket %s tag %s', projectName, tagKey)
  const tagSet = await getTagSet(projectName)
  const tag = tagSet.find(({ Key }) => Key === tagKey)
  debug('%s: %s', tagKey, tag && tag.Value)

  if (!tag) return undefined
  return tag.Value
}

export async function setTag(projectName, tagKey, tagValue) {
  debug('Set bucket %s tag %s to %s', projectName, tagKey, tagValue)
  const existingTags = await getTagSet(projectName)
  const unchangedTags = existingTags.filter(tag => tag.Key !== tagKey)

  return s3
    .putBucketTagging({
      Bucket: projectName,
      Tagging: {
        TagSet: [...unchangedTags, { Key: tagKey, Value: tagValue }]
      }
    })
    .promise()
}

async function getTagSet(projectName) {
  try {
    const data = await s3.getBucketTagging({ Bucket: projectName }).promise()
    return data.TagSet
  } catch (error) {
    if (error.code !== 'NoSuchTagSet') throw error

    // no tags yet set
    return []
  }
}
