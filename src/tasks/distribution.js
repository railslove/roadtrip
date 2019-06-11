import * as cf from '../lib/cloudfront'
import * as acm from '../lib/acm'

export const create = {
  title: 'Create distribution',
  task: async (ctx, task) => {
    task.output = 'Checking if distribution exists...'
    const existingDistribution = await cf.get(ctx.trip.name)

    async function getCertificate() {
      // Don't need to get certificate if we have no domain
      if (!ctx.trip.domain) return undefined

      let certificate
      if (ctx.trip.https === true) {
        task.output = 'Fetching certificate...'
        certificate = await acm.getCertificateForDomain(ctx.trip.domain)
      }

      if (!certificate && ctx.trip.https === true) {
        throw new Error(
          `No certificate matching the domain ${
            ctx.trip.domain
          } found in AWS Certificate Manager. Create or import a certificate in order to use this domain.`
        )
      }

      return certificate
    }

    if (existingDistribution) {
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

      return
    }

    const certificate = await getCertificate()
    task.output = 'Creating distribution...'
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

    return cf.invalidatePaths(ctx.trip.name, paths, {
      cloudfrontId: ctx.cloudfrontId
    })
  }
}
