import path from 'path'
import { flags } from '@oclif/command'
import Listr from 'listr'
import Command from '../lib/command'
import { bucket } from '..'

class BucketCommand extends Command {
  async run() {
    const { args, flags } = this.parse(BucketCommand)

    const bucketName = this.tripconfig.site || flags.site
    if (!bucketName) {
      this.error('No site name configured.')
    }

    const indexFile = this.tripconfig.indexFile || flags.indexFile
    const errorFile = this.tripconfig.errorFile || flags.errorFile
    const syncDir = this.tripconfig.dir || flags.dir

    function getTask() {
      switch (args.action) {
        case 'create':
          return BucketCommand.tasks.create(bucketName)
        case 'website':
          return BucketCommand.tasks.website(bucketName, {
            indexFile,
            errorFile
          })
        case 'sync':
          return BucketCommand.tasks.sync(bucketName, syncDir)
        case 'setup':
          return BucketCommand.tasks.setup(bucketName, syncDir, {
            indexFile,
            errorFile
          })
      }
    }

    return this.runTask(getTask())
  }
}

BucketCommand.tasks = {
  create: bucketName => ({
    title: 'Create bucket',
    task: async (ctx, task) => {
      try {
        task.output = 'Checking if bucket exists...'
        ctx.exists = await bucket.exists(bucketName)
      } catch (error) {
        if (error.code !== 'Forbidden') throw error
        throw new Error(
          `A Bucket with the name "${bucketName}" already exists. Bucket names must be unique.`
        )
      }

      if (ctx.exists) {
        task.skip('Bucket already exists')
        return
      }

      task.output = 'Creating bucket...'
      return bucket.create(bucketName)
    }
  }),

  website: (bucketName, { indexFile, errorFile }) => ({
    title: 'Make bucket a website',
    task: async (_ctx, _task) => {
      return bucket.website(bucketName, { indexFile, errorFile })
    }
  }),

  sync: (bucketName, syncDir) => ({
    title: 'Sync files',
    task: async (ctx, task) => {
      function onUpdate(action, key) {
        task.output = `${action}: ${key}`
      }

      const syncs = await bucket.sync(bucketName, syncDir, { onUpdate })
      ctx.syncedFiles = syncs

      if (syncs.length < 1) {
        task.skip('No files to sync')
        return
      }

      const word = syncs.length === 1 ? 'file' : 'files'
      task.title = `Synced ${syncs.length} ${word}`
    }
  }),

  setup: (bucketName, syncDir, { indexFile, errorFile }) => [
    BucketCommand.tasks.create(bucketName),
    BucketCommand.tasks.website(bucketName, { indexFile, errorFile }),
    BucketCommand.tasks.sync(bucketName, syncDir)
  ]
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
  ...Command.flags,
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
  })
}

export default BucketCommand
