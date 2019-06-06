import AWS from 'aws-sdk'

const apiVersion = '2006-03-01'

export default class Bucket {
  constructor({ region }) {
    AWS.config.update({ region })
    this.s3 = new AWS.S3({ apiVersion })
  }

  async exists(name) {
    try {
      await this.s3.headBucket({ Bucket: name }).promise()
      return true
    } catch (error) {
      if (error.code !== 'NotFound') throw error
      return false
    }
  }

  async create(name) {
    const ACL = 'public-read'
    return this.s3.createBucket({ ACL, Bucket: name }).promise()
  }

  async website(name, { indexKey, errorKey }) {
    return this.s3
      .putBucketWebsite({
        Bucket: name,
        WebsiteConfiguration: {
          IndexDocument: { Suffix: indexKey },
          ErrorDocument: { Key: errorKey }
        }
      })
      .promise()
  }
}
