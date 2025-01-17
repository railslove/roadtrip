import AWS from 'aws-sdk'
import { merge } from 'lodash'
import * as s3 from './s3'

const debug = require('debug')('roadtrip:lib:cloudfront')
const cf = new AWS.CloudFront({ apiVersion: '2018-11-05', region: 'us-east-1' })
const BUCKET_TAG_KEY = 'cloudfront_id'

export async function get(projectName) {
  const cloudfrontId = await getDistributionIdFromBucket(projectName)
  debug('Bucket: %s, CloudFront Id: %s', projectName, cloudfrontId)
  if (!cloudfrontId) return undefined

  try {
    const data = await cf.getDistribution({ Id: cloudfrontId }).promise()
    debug('CloudFront exists: %O', data)
    return data.Distribution
  } catch (error) {
    if (error.code !== 'NotFound') {
      debug('cf.getDistribution: Unexpected error code %s', error.code)
      throw error
    }

    debug('No CloudFront for bucket %s found.', projectName)
    return undefined
  }
}

export async function create(projectName, domain, { certARN, https }) {
  const config = await createConfig({ projectName, domain, certARN, https })
  debug('Create CloudFront with config: %O', config)

  const data = await cf
    .createDistribution({ DistributionConfig: config })
    .promise()
  debug('CloudFront created: %O', data)
  await setDistributionIdToBucket(projectName, data.Id)
  return data.Distribution
}

export async function update(
  projectName,
  domain,
  { cloudfrontId, certARN, https }
) {
  const id = cloudfrontId || (await getDistributionIdFromBucket(projectName))

  // Get the current config from aws. When updating a distribution, CloudFront
  // wants the complete config with more required fields than when creating a
  // distribution.
  const data = await cf.getDistributionConfig({ Id: id }).promise()
  const { DistributionConfig: currentConfig, ETag: etag } = data
  debug(
    'Current CloudFront Config for bucket %s: %O',
    projectName,
    currentConfig
  )

  const defConfig = await createConfig({ projectName, domain, certARN, https })
  const specialConfig = {
    // CallerReference is required but needs to stay the same. Else CloudFront returns an IllegalUpdate error.
    CallerReference: currentConfig.CallerReference
  }
  const config = merge(currentConfig, defConfig, specialConfig)
  debug('Update CloudFront %s with config: %O', id, config)

  const newData = await cf
    .updateDistribution({ DistributionConfig: config, IfMatch: etag, Id: id })
    .promise()
  return newData.Distribution
}

export async function invalidatePaths(projectName, paths, { cloudfrontId }) {
  const id = cloudfrontId || (await getDistributionIdFromBucket(projectName))
  // make sure paths start with a slash
  const sanitizedPaths = paths.map(p => (p.startsWith('/') ? p : `/${p}`))

  const params = {
    DistributionId: id,
    InvalidationBatch: {
      CallerReference: new Date().toISOString(),
      Paths: {
        Quantity: sanitizedPaths.length,
        Items: sanitizedPaths
      }
    }
  }
  debug('CloudFront Invalidation request: %O', params)
  return cf.createInvalidation(params).promise()
}

async function getDistributionIdFromBucket(projectName) {
  const value = await s3.getTag(projectName, BUCKET_TAG_KEY)
  return value
}

async function setDistributionIdToBucket(projectName, id) {
  return s3.setTag(projectName, BUCKET_TAG_KEY, id)
}

async function createConfig({ projectName, domain, certARN, https }) {
  const bucketDomain = await s3.getDomain(projectName)

  // dear aws, this is madness.
  const config = {
    Enabled: true,
    Comment: projectName,
    CallerReference: new Date().toISOString(), // some unique thing
    PriceClass: 'PriceClass_100', // us, ca and eu regions
    Origins: {
      Quantity: 1,
      Items: [
        {
          Id: projectName,
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
    DefaultCacheBehavior: {
      TargetOriginId: projectName,
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
      ViewerProtocolPolicy:
        certARN || https ? 'redirect-to-https' : 'allow-all',
      MinTTL: 60 * 60 * 24 * 365, // Cache files on CDN for 1 year. Cache will be invalidated programatically when deploying
      Compress: true,
      AllowedMethods: {
        Quantity: 2,
        Items: ['GET', 'HEAD']
      }
    }
  }

  if (domain) {
    config.Aliases = {
      Quantity: 1,
      Items: [domain]
    }
  }

  if (certARN) {
    config.ViewerCertificate = {
      CloudFrontDefaultCertificate: false,
      SSLSupportMethod: 'sni-only', // All modern browsers support SNI
      MinimumProtocolVersion: 'TLSv1', // required when sni-only is set
      ACMCertificateArn: certARN
    }
  }

  if (https && !certARN) {
    config.ViewerCertificate = {
      CloudFrontDefaultCertificate: true
    }
  }

  return config
}
