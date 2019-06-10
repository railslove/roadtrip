import AWS from 'aws-sdk'
import { merge } from 'lodash'

const cf = new AWS.CloudFront({ apiVersion: '2018-11-05' })
const s3 = new AWS.S3({ apiVersion: '2006-03-01' })
const BUCKET_TAG_KEY = 'cloudfront_id'

export async function get(siteName) {
  const cloudfrontId = await getIdFromBucket(siteName)
  if (!cloudfrontId) return undefined

  try {
    const data = await cf.getDistribution({ Id: cloudfrontId }).promise()
    return data.Distribution
  } catch (error) {
    return undefined
  }
}

export async function create(siteName, { certARN, configOverrides = {} }) {
  const defaultConfig = await createConfig({ siteName, certARN })
  const config = merge(defaultConfig, configOverrides)

  const data = await cf
    .createDistribution({ DistributionConfig: config })
    .promise()
  await setIdToBucket(siteName, data.Id)
  return data.Distribution
}

export async function update(
  siteName,
  { cloudfrontId, certARN, configOverrides = {} }
) {
  const id = cloudfrontId || (await getIdFromBucket(siteName))

  // Get the current config from aws. When updating a distribution, CloudFront
  // wants the complete config with more required fields than when creating a
  // distribution.
  const data = await cf.getDistributionConfig({ Id: id }).promise()
  const { DistributionConfig: currentConfig, ETag: etag } = data

  const defaultConfig = await createConfig({ siteName, certARN })
  const specialConfig = {
    // CallerReference is required but needs to stay the same. Else CloudFront returns an IllegalUpdate error.
    CallerReference: currentConfig.CallerReference
  }
  const config = merge(
    currentConfig,
    defaultConfig,
    configOverrides,
    specialConfig
  )

  const newData = await cf
    .updateDistribution({ DistributionConfig: config, IfMatch: etag, Id: id })
    .promise()
  return newData.Distribution
}

export async function invalidatePaths(siteName, paths, { cloudfrontId } = {}) {
  const id = cloudfrontId || (await getIdFromBucket(siteName))
  // make sure paths start with a slash
  const sanitizedPaths = paths.map(p => (p.startsWith('/') ? p : `/${p}`))

  return cf
    .createInvalidation({
      DistributionId: id,
      InvalidationBatch: {
        CallerReference: new Date().toISOString(),
        Paths: {
          Quantity: sanitizedPaths.length,
          Items: sanitizedPaths
        }
      }
    })
    .promise()
}

async function getIdFromBucket(bucketName) {
  const data = await s3.getBucketTagging({ Bucket: bucketName }).promise()
  const tag = data.TagSet.find(({ Key }) => Key === BUCKET_TAG_KEY)

  if (!tag) return undefined
  return tag.Value
}

async function setIdToBucket(bucketName, id) {
  return s3
    .putBucketTagging({
      Bucket: bucketName,
      Tagging: {
        TagSet: [{ Key: BUCKET_TAG_KEY }, { Value: id }]
      }
    })
    .promise()
}

async function createConfig({ siteName, certARN }) {
  const region = await s3.getBucketLocation({ Bucket: siteName }).promise()
  const bucketDomain = `${siteName}.s3-website.${region}.amazonaws.com`

  // dear aws, this is madness.
  return {
    Enabled: true,
    Comment: siteName,
    CallerReference: new Date().toISOString(), // some unique thing
    PriceClass: 'PriceClass_100', // us, ca and eu regions
    Aliases: {
      Quantity: 1,
      Items: [siteName]
    },
    Origins: {
      Quantity: 1,
      Items: [
        {
          Id: siteName,
          DomainName: bucketDomain,
          CustomOriginConfig: {
            HTTPPort: 80,
            HTTPSPort: 443,
            // AWS only allows http for communication between cloudfront and s3.
            // https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/distribution-web-values-specify.html#DownloadDistValuesOriginProtocolPolicy
            OriginProtocolPolicy: 'http-only'
          }
        }
      ]
    },
    ViewerCetrificate: {
      CloudFrontDefaultCertificate: false,
      SSLSupportMethod: 'sni-only', // All modern browsers support SNI
      MinimumProtocolVersion: 'TLSv1', // required when sni-only
      ACMCertificateArn: certARN
    },
    DefaultCacheBehavior: {
      TargetOriginId: siteName,
      ForwardedValues: {
        QueryString: false,
        Cookies: {
          Forward: 'none'
        }
      },
      TrustedSigners: {
        Enabled: false,
        Quantity: 0
      },
      ViewerProtocolPolicy: 'redirect-to-https',
      MinTTL: 60 * 60 * 24 * 365, // Cache files on CDN for 1 year. Cache will be invalidated programatically when deploying
      Compress: true,
      AllowedMethods: {
        Quantity: 2,
        Items: ['GET', 'HEAD']
      }
    }
  }
}
