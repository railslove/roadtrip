import path from 'path'
import { flags } from '@oclif/command'
import Listr from 'listr'
import untildify from 'untildify'
import delay from 'delay'
import TripCommand from '../lib/command'
import { s3, cacheControl } from '..'

export default class BucketCommand extends TripCommand {
  async run() {
    const { args, flags } = this.parse(BucketCommand)

    const ctx = {
      siteName: this.siteName,
      projectDir: this.projectDir,
      dir: this.tripconfig.dir || flags.dir,
      indexFile: this.tripconfig.indexFile || flags.indexFile,
      errorFile: this.tripconfig.errorFile || flags.errorFile,
      cacheControlRules: this.tripconfig.cacheControl || {}
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

BucketCommand.description = `manage the s3 bucket for a site
Performs actions related to the S3 bucket.

create:
Creates a bucket with the name of the site. Does nothing if the bucket already exists.

website:
Configures the bucket as a static website.

sync:
Syncs the files of the local directory to the bucket. Only syncs changed files.
If a file exists on the bucket but not locally, the file will be deleted.
If cacheControl has changed, all files are treated as changed files to update Cache-Control headers.

setup:
Runs create, website and sync consecutively.
`

BucketCommand.args = [
  {
    name: 'action',
    required: true,
    options: ['create', 'website', 'sync', 'setup'],
    description: 'action to be performed on the bucket'
  }
]

BucketCommand.flags = {
  dir: flags.string({
    char: 'd',
    default: '.',
    description: 'path to the directory which is synced to the bucket'
  }),
  indexFile: flags.string({
    default: 'index.html',
    description: 'name of the file which acts as index page'
  }),
  errorFile: flags.string({
    default: '404.html',
    description: 'name of the file for 404 Not Found errors'
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
    if (!ctx.bucketExisted) {
      const waitSec = 5
      task.output = `Bucket was just created. Wait ${waitSec} seconds before continuing...`
      await delay(waitSec * 1000)
    }

    task.output = 'Checking if cache-control has changed...'
    const existingCacheHash = await s3.getCacheHash(ctx.siteName)
    const nowCacheHash = cacheControl.generateCacheHash(ctx.cacheControlRules)
    const cacheRulesChanged = existingCacheHash !== nowCacheHash

    if (cacheRulesChanged) {
      task.output = 'Cache rules have changed. Saving version on bucket...'
      await s3.setCacheHash(ctx.siteName, nowCacheHash)
    }

    task.output = 'Syncing...'
    function onUpdate(action, key) {
      task.output = `${action}: ${key}`
    }

    const syncDir = path.resolve(ctx.projectDir, untildify(ctx.dir))
    const syncs = await s3.sync(ctx.siteName, syncDir, {
      onUpdate,
      cacheControlRules: ctx.cacheControlRules,
      forceAll: cacheRulesChanged
    })
    ctx.syncedFiles = syncs

    if (syncs.length < 1) {
      task.skip('No files to sync')
      return
    }

    const word = syncs.length === 1 ? 'file' : 'files'
    task.title = `Synced ${syncs.length} ${word}`
  }
}
