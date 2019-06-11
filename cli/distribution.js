import Listr from 'listr'
import chalk from 'chalk'
import TripCommand from '../lib/command'
import { cf, acm } from '..'

export default class DistributionCommand extends TripCommand {
  async run() {
    const { args } = this.parse(DistributionCommand)

    const ctx = {
      siteName: this.siteName
    }

    const tasks = new Listr(DistributionCommand.getTasks(args.action))
    const outCtx = await tasks
      .run(ctx)
      .catch(error => this.error(error.toString()))

    if (args.action !== 'invalidate') {
      if (outCtx.cloudfrontJustCreated) {
        this.log(
          chalk`{bold Note:} The distribution was just set up. It can take up to 10-20 minutes to be fully available.`
        )
      }
      this.log('URL of your distribution:')
      this.log(`  https://${outCtx.cloudfrontDomainName}`)
    }
  }

  static getTasks(action) {
    switch (action) {
      case 'create':
        return [createTask]
      case 'invalidate':
        return [invalidateTask]
      case 'setup':
        return [createTask, invalidateTask]
      default:
        return []
    }
  }
}

DistributionCommand.description = `manage the cloudfront distribution for a site
Performs actions related to the CloudFront distribution (CDN).

create:
Creates a distribution and connects it to the S3 bucket of the site. If the distribution already exists, the configuration will be updated.
It looks for a matching certificate in the Certificate Manager. If no Certificate is found, it exits with an error.

invalidate:
Invalidates the cache on the distribution.

setup:
Runs create and invalidate consecutively.
`

DistributionCommand.args = [
  {
    name: 'action',
    required: true,
    options: ['create', 'invalidate', 'setup'],
    description: 'action to be performed on the distribution'
  }
]

DistributionCommand.flags = {
  ...TripCommand.flags
}

export const createTask = {
  title: 'Create distribution',
  task: async (ctx, task) => {
    try {
      task.output = 'Checking if distribution exists...'
      const distribution = await cf.get(ctx.siteName)
      ctx.cloudfrontId = distribution.Id
    } catch (_error) {
      throw _error
      // Intentionally left blank. If an error was thrown, a distribution needs
      // to be created.
    }

    if (ctx.cloudfrontId) {
      task.title = 'Update distribution'
      task.output = 'Distribution exists. Updating...'
      const updateResponse = await cf.update(ctx.siteName, {
        cloudfrontId: ctx.cloudfrontId
      })
      ctx.cloudfrontDomainName = updateResponse.DomainName
      task.title = `Update distribution: ${ctx.cloudfrontDomainName}`
    } else {
      task.output = 'Creating distribution. Fetching certificate...'
      const cert = await acm.getCertificateForDomain(ctx.siteName)
      ctx.cloudfrontJustCreated = true

      if (!cert) {
        throw new Error(
          `No certificate matching the domain ${ctx.siteName} found in AWS Certificate Manager. Create or import a certificate in order to use this domain.`
        )
      }

      task.output = 'Creating distribution...'
      const createResponse = await cf.create(ctx.siteName, {
        certARN: cert.CertificateArn
      })
      ctx.cloudfrontDomainName = createResponse.DomainName
      task.title = `Create distribution: ${ctx.cloudfrontDomainName}`
    }
  }
}

export const invalidateTask = {
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

    return cf.invalidatePaths(ctx.siteName, paths, {
      cloudfrontId: ctx.cloudfrontId
    })
  }
}
