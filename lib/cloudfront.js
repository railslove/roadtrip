import AWS from 'aws-sdk'
import * as s3 from './s3'

const apiVersion = '2018-11-05'
const cf = new AWS.CloudFront({ apiVersion })

export async function getForBucket(bucketName) {
  const cid = await s3.getCloundfrontId(bucketName)
  const data = await cf.getDistribution({ Id: cid }).promise()
  return data.Distribution
}

export async function create(siteName, domain) {}
