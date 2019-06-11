import util from 'util'
import path from 'path'
import fs from 'fs'
import AWS from 'aws-sdk'
import s3diff from 's3-diff'
import mime from 'mime-types'
import { getCacheControl } from './cache-control'

const s3 = new AWS.S3({ apiVersion: '2006-03-01' })
const BUCKET_CACHE_TAG = 'roadtrip_cache_hash'

export async function exists(bucketName) {
  try {
    await s3.headBucket({ Bucket: bucketName }).promise()
    return true
  } catch (error) {
    // NotFound means the bucket name can be claimed. Other errors could include
    // permission errors. This error has all infos the user needs.
    if (error.code !== 'NotFound') throw error
    return false
  }
}

export async function create(bucketName) {
  const ACL = 'public-read'
  return s3.createBucket({ ACL, Bucket: bucketName }).promise()
}

export async function website(bucketName, { indexFile, errorFile }) {
  return s3
    .putBucketWebsite({
      Bucket: bucketName,
      WebsiteConfiguration: {
        IndexDocument: { Suffix: indexFile },
        ErrorDocument: { Key: errorFile }
      }
    })
    .promise()
}

export async function sync(
  bucketName,
  syncDir,
  { onUpdate, cacheControlRules, forceAll = true } = {}
) {
  // diff between local and remote
  const actions = await util.promisify(s3diff)({
    local: syncDir,
    remote: { bucket: bucketName },
    recursive: true,
    globOpts: { dot: false }
  })

  const syncs = [
    ...actions.changed.map(file => ({ file, type: 'update' })),
    ...(forceAll ? actions.keep.map(file => ({ file, type: 'update' })) : []), // forceAll: also update non-changed files, e.g. when headers were changed
    ...actions.extra.map(file => ({ file, type: 'create' })),
    ...actions.missing.map(file => ({ file, type: 'delete' }))
  ]

  for (let { file, type } of syncs) {
    const fullFilePath = path.resolve(syncDir, file)
    onUpdate(type, file)

    switch (type) {
      case 'update':
      case 'create':
        await s3
          .putObject({
            Bucket: bucketName,
            Body: fs.readFileSync(fullFilePath),
            Key: file,
            ACL: 'public-read',
            ContentType: mime.lookup(fullFilePath) || undefined,
            CacheControl: getCacheControl(file, cacheControlRules)
          })
          .promise()
        break
      case 'delete':
        await s3
          .deleteObject({
            Bucket: bucketName,
            Key: file
          })
          .promise()
        break
      default: // intentionally left blank
    }
  }

  return syncs
}

export async function getRegion(bucketName) {
  const { LocationConstraint: region } = await s3
    .getBucketLocation({ Bucket: bucketName })
    .promise()
  return region || 'us-east-1' // aws returns an empty string if region is us-east-1
}

export async function getCacheHash(bucketName) {
  const value = await getTag(bucketName, BUCKET_CACHE_TAG)
  return value
}

export async function setCacheHash(bucketName, hash) {
  return setTag(bucketName, BUCKET_CACHE_TAG, hash)
}

export async function getTag(bucketName, tagKey) {
  const data = await s3.getBucketTagging({ Bucket: bucketName }).promise()
  const tag = data.TagSet.find(({ Key }) => Key === tagKey)

  if (!tag) return undefined
  return tag.Value
}

export async function setTag(bucketName, tagKey, tagValue) {
  const { TagSet: existingTags } = await s3
    .getBucketTagging({ Bucket: bucketName })
    .promise()

  const unchangedTags = existingTags.filter(tag => tag.Key !== tagKey)

  return s3
    .putBucketTagging({
      Bucket: bucketName,
      Tagging: {
        TagSet: [...unchangedTags, { Key: tagKey, Value: tagValue }]
      }
    })
    .promise()
}
