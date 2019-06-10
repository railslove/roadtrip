import { flags } from '@oclif/command'
import Listr from 'listr'
import TripCommand from '../lib/command'
import { r53 } from '..'

export default class DomainCommand extends TripCommand {
  async run() {
    const { args } = this.parse(DomainCommand)

    const ctx = {
      siteName: this.siteName
    }

    const tasks = new Listr(DomainCommand.getTasks(args.action))
    tasks.run(ctx).catch(error => this.error(error.toString()))
  }

  static getTasks(action) {
    switch (action) {
      case 'create':
        return [createTask]
      default:
        return []
    }
  }
}

DomainCommand.description = `Describe the command here
...
Extra documentation goes here
`

DomainCommand.args = [
  {
    name: 'action',
    required: true,
    options: ['create']
  }
]

DomainCommand.flags = {
  site: flags.string({
    char: 's'
  }),
  ...TripCommand.flags
}

export const createTask = {
  title: 'Create dns entry',
  task: async (ctx, task) => {
    task.output = 'Checking if dns is set up...'
    const exists = await r53.exists(ctx.siteName, ctx.cloudfrontDomainName)

    if (exists) {
      task.skip('DNS already set up')
      return
    }

    task.output = 'Insert/update dns record...'
    return r53.upsert(ctx.siteName, ctx.cloudfrontDomainName)
  }
}
