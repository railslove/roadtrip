import path from 'path'
import { Command, flags } from '@oclif/command'
import Listr from 'listr'
import Bucket from '../lib/bucket'

class BucketCommand extends Command {
  async run() {
    const { args, flags } = this.parse(BucketCommand)
    this.flags = flags
    this.bucket = new Bucket({ region: flags.region })

    await this[args.action]()
  }

  async create() {
    try {
      await this.bucket.create(this.flags.name)
      this.log('Bucket created: ' + this.flags.name)
    } catch (error) {
      this.error(error.message)
    }
  }

  async setup() {
    const tasks = new Listr([
      {
        title: 'Create bucket',
        task: async (ctx, task) => {
          try {
            ctx.exists = await this.bucket.exists(this.flags.name)
          } catch (error) {
            if (error.code !== 'Forbidden') throw error
            throw new Error(
              `A Bucket with the name "${
                this.flags.name
              }" already exists. Bucket names must be unique.`
            )
          }

          if (ctx.exists) {
            task.skip('Bucket already exists')
            return
          }

          return this.bucket.create(this.flags.name)
        }
      },
      {
        title: 'Make bucket a website',
        task: async (ctx, task) => {
          return this.bucket.website(this.flags.name, {
            indexKey: 'index.html',
            errorKey: '404.html'
          })
        }
      }
    ])

    return tasks.run().catch(e => this.error(e.toString()))
  }
}

BucketCommand.description = `Describe the command here
...
Extra documentation goes here
`

BucketCommand.args = [
  { name: 'action', required: true, options: ['create', 'setup'] }
]

BucketCommand.flags = {
  name: flags.string({
    char: 'n',
    required: true
  }),
  region: flags.string({
    char: 'r',
    default: 'us-west-2'
  }),
  file: flags.string({
    char: 'f'
  })
}

export default BucketCommand
