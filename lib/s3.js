import util from 'util'
import path from 'path'
import fs from 'fs'
import AWS from 'aws-sdk'
import s3diff from 's3-diff'
import mime from 'mime-types'
import untildify from 'untildify'

const apiVersion = '2006-03-01'
const s3 = new AWS.S3({ apiVersion })

export async function exists(bucketName) {
  try {
    await s3.headBucket({ Bucket: bucketName }).promise()
    return true
  } catch (error) {
    if (error.code !== 'NotFound') throw error
    return false
  }
}

export async function create(bucketName) {
  const ACL = 'public-read'
  return s3.createBucket({ ACL, Bucket: name }).promise()
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

export async function setCloudfrontId(bucketName, cloudfrontId) {
  return s3
    .putBucketTagging({
      Bucket: bucketName,
      Tagging: {
        TagSet: [{ Key: 'cloudfrontid' }, { Value: cloudfrontId }]
      }
    })
    .promise()
}

export async function getCloundfrontId(bucketName) {
  const data = await s3.getBucketTagging({ Bucket: bucketName }).promise()
  const tag = data.TagSet.find(({ Key }) => Key === 'cloudfrontid')

  if (!tag) return undefined
  return tag.Value
}

export async function sync(bucketName, syncDir, { onUpdate } = {}) {
  const dirpath = path.resolve(untildify(syncDir))
  const actions = await util.promisify(s3diff)({
    local: dirpath,
    remote: { bucket: bucketName },
    recursive: true,
    globOpts: { dot: true }
  })

  const syncs = [
    ...actions.changed.map(file => ({ file, type: 'update' })),
    ...actions.extra.map(file => ({ file, type: 'create' })),
    ...actions.missing.map(file => ({ file, type: 'delete' }))
  ]

  for (let { file, type } of syncs) {
    const fullFilePath = path.resolve(dirpath, file)
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
            ContentType: mime.lookup(fullFilePath)
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
