import * as cf from '../lib/cloudfront'
import * as acm from '../lib/acm'

const debug = require('debug')('roadtrip:task:distribution')

export const create = {
  title: 'Create distribution',
  task: async (ctx, task) => {
    task.output = 'Checking if distribution exists...'
    const existingDistribution = await cf.get(ctx.trip.name)
    debug(
      'Existing distribution: %s',
      existingDistribution ? existingDistribution.Id : 'none'
    )

    async function getCertificate() {
      if (!ctx.trip.domain) {
        debug('No custom domain set. No custom certificate necessary.')
        return undefined
      }

      let certificate
      if (ctx.trip.https === true) {
        debug('Project has https activated. Trying to find a certificate.')
        task.output = 'Fetching certificate...'
        certificate = await acm.getCertificateForDomain(ctx.trip.domain)
        debug('Found certificate: %O', certificate)
      }

      if (!certificate && ctx.trip.https === true) {
        throw new Error(
          `No certificate matching the domain ${ctx.trip.domain} found in AWS Certificate Manager. Create or import a certificate in order to use this domain.`
        )
      }

      return certificate
    }

    if (existingDistribution) {
      debug('Distribution exists. Update configuration: %o', {
        projectName: ctx.trip.name,
        domain: ctx.trip.domain,
        https: ctx.trip.https
      })
      const certificate = await getCertificate()
      task.title = 'Update distribution'
      task.output = 'Distribution exists. Updating...'
      const updatedDistribution = await cf.update(
        ctx.trip.name,
        ctx.trip.domain,
        {
          certARN: certificate && certificate.CertificateArn,
          cloudfrontId: existingDistribution.Id,
          https: ctx.trip.https
        }
      )
      ctx.cloudfrontDomainName = updatedDistribution.DomainName
      ctx.cloudfrontId = updatedDistribution.Id
      debug('Distribution updated. Id: %s', updatedDistribution.Id)

      return
    }

    const certificate = await getCertificate()
    task.output = 'Creating distribution...'
    debug('Distribution does not exist. Create: %o', {
      projectName: ctx.trip.name,
      domain: ctx.trip.domain,
      https: ctx.trip.https
    })
    const createdDistribution = await cf.create(
      ctx.trip.name,
      ctx.trip.domain,
      {
        https: ctx.trip.https,
        certARN: certificate && certificate.CertificateArn
      }
    )

    ctx.cloudfrontJustCreated = true
    ctx.cloudfrontDomainName = createdDistribution.DomainName
    ctx.cloudfrontId = createdDistribution.Id
    debug('Distribution created. Id: %s', createdDistribution.Id)
  }
}

export const invalidate = {
  title: 'Invalidate paths on CDN',
  skip: ctx => {
    if (ctx.cloudfrontJustCreated) {
      return 'The distribution was just created. No paths to invalidate.'
    }
  },
  task: async (ctx, _task) => {
    // TODO: We could use ctx.syncedFiles (if available) to only invalidate
    // synced files. This would keep unchanged files in CloudFront's caches, but
    // more than 1000 invalidations/month cost $0.005 per invalidation-path.
    // The wildcard counts as one path, so it could save some money.
    // If asset paths contain hashes for client-cache-busting, they are cached
    // in the user's browser anyways.
    // Or we simply make it a config flag, which can be used to only invalidate
    // synced files, and for other environments, everything is invalidated.
    //
    // For now we invalidate everything on the CDN.
    const paths = ['*']

    debug('Invalidate paths on cloudfront: %O', paths)
    return cf.invalidatePaths(ctx.trip.name, paths, {
      cloudfrontId: ctx.cloudfrontId
    })
  }
}
