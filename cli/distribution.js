import { flags } from '@oclif/command'
import Listr from 'listr'
import TripCommand from '../lib/command'
import { cf } from '..'

export default class DistributionCommand extends TripCommand {
  async run() {
    const { args } = this.parse(DistributionCommand)

    const ctx = {
      siteName: this.siteName
    }

    const tasks = new Listr(DistributionCommand.getTasks(args.action))
    try {
      const outCtx = await tasks.run(ctx)
      this.log('URL of your distribution:')
      this.log(`  https://${outCtx.cloudfrontDomainName}`)
    } catch (error) {
      this.error(error.toString())
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

DistributionCommand.description = `Describe the command here
...
Extra documentation goes here
`

DistributionCommand.args = [
  {
    name: 'action',
    required: true,
    options: ['create', 'invalidate', 'setup']
  }
]

DistributionCommand.flags = {
  site: flags.string({
    char: 's'
  }),
  ...TripCommand.flags
}

export const createTask = {
  title: 'Create distribution',
  task: async (ctx, task) => {
    try {
      task.output = 'Checking if distribution exists...'
      const distribution = await cf.exists(ctx.siteName)
      ctx.cloudfrontId = distribution.Id
    } catch (_error) {
      // Intentionally left blank. If an error was thrown, a distribution needs
      // to be created.
    }

    ctx.cloudfrontJustCreated = ctx.cloudfrontId ? false : true

    let data
    if (ctx.cloudfrontJustCreated) {
      task.output = 'Distribution exists. Updating...'
      data = await cf.update(ctx.siteName, { cloudfrontId: ctx.cloudfrontId })
    } else {
      task.output = 'Creating distribution...'
      data = await cf.create(ctx.siteName)
    }

    ctx.cloudfrontDomainName = data.DomainName
    this.title = `Create distribution: ${ctx.cloudfrontDomainName}`
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
