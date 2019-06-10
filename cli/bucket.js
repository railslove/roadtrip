import { flags } from '@oclif/command'
import Listr from 'listr'
import TripCommand from '../lib/command'
import { s3 } from '..'

export default class BucketCommand extends TripCommand {
  async run() {
    const { args, flags } = this.parse(BucketCommand)

    const ctx = {
      siteName: this.siteName,
      dir: this.tripconfig.dir || flags.dir,
      indexFile: this.tripconfig.indexFile || flags.indexFile,
      errorFile: this.tripconfig.errorFile || flags.errorFile
    }

    const tasks = new Listr(BucketCommand.getTasks(args.action))
    tasks.run(ctx).catch(error => this.error(error.toString()))
  }

  static getTasks(action) {
    switch (action) {
      case 'create':
        return [createTask]
      case 'website':
        return [websiteTask]
      case 'sync':
        return [syncTask]
      case 'setup':
        return [createTask, websiteTask, syncTask]
      default:
        return []
    }
  }
}

BucketCommand.description = `Describe the command here
...
Extra documentation goes here
`

BucketCommand.args = [
  {
    name: 'action',
    required: true,
    options: ['create', 'website', 'sync', 'setup']
  }
]

BucketCommand.flags = {
  site: flags.string({
    char: 's'
  }),
  dir: flags.string({
    char: 'd',
    default: '.'
  }),
  indexFile: flags.string({
    default: 'index.html'
  }),
  errorFile: flags.string({
    default: '404.html'
  }),
  ...TripCommand.flags
}

export const createTask = {
  title: 'Create bucket',
  task: async (ctx, task) => {
    try {
      task.output = 'Checking if bucket exists...'
      ctx.bucketExisted = await s3.exists(ctx.siteName)
    } catch (error) {
      if (error.code !== 'Forbidden') throw error
      throw new Error(`A Bucket with the name "${ctx.siteName}" already exists`)
    }

    if (ctx.bucketExisted) {
      task.skip('Bucket already exists')
      return
    }

    task.output = 'Creating bucket...'
    return s3.create(ctx.siteName)
  }
}

export const websiteTask = {
  title: 'Make bucket a website',
  task: async (ctx, _task) => {
    const { indexFile, errorFile } = ctx
    return s3.website(ctx.siteName, { indexFile, errorFile })
  }
}

export const syncTask = {
  title: 'Sync files',
  task: async (ctx, task) => {
    function onUpdate(action, key) {
      task.output = `${action}: ${key}`
    }

    const syncs = await s3.sync(ctx.siteName, ctx.dir, { onUpdate })
    ctx.syncedFiles = syncs

    if (syncs.length < 1) {
      task.skip('No files to sync')
      return
    }

    const word = syncs.length === 1 ? 'file' : 'files'
    task.title = `Synced ${syncs.length} ${word}`
  }
}
