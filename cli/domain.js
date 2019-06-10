import { flags } from '@oclif/command'
import Listr from 'listr'
import TripCommand from '../lib/command'
import { r53 } from '..'

export default class DomainCommand extends TripCommand {
  async run() {
    const { args, flags } = this.parse(DomainCommand)

    const ctx = {
      siteName: this.siteName,
      cloudfrontDomainName: flags.alias
    }

    const tasks = new Listr(DomainCommand.getTasks(args.action))
    return tasks.run(ctx).catch(error => this.error(error.toString()))
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

DomainCommand.description = `manage the domain and dns for a site
Performs actions realted to the DNS on Route53.

create:
Creates a record pointing to the CloudFront URL as an alias. If the record doesn't exist or the alias is wrong, it will be updated.
`

DomainCommand.args = [
  {
    name: 'action',
    required: true,
    options: ['create'],
    description: 'action to be performed on the hosted zone'
  }
]

DomainCommand.flags = {
  site: flags.string({
    char: 's'
  }),
  alias: flags.string({
    char: 'a',
    required: true
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
