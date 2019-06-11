import TripCommand from '../../command'
import * as domain from '../../tasks/domain'

export default class DomainConnectCommand extends TripCommand {
  async run() {
    const { args } = this.parse(DomainConnectCommand)
    await this.runTasks([domain.connect], { cloudfrontDomainName: args.alias })
  }
}

DomainConnectCommand.description = `connect a custom domain to the project
Creates a record pointing to the CloudFront URL as an alias. If the record doesn't exist or the alias is wrong, it will be updated.
`

DomainConnectCommand.args = [
  {
    name: 'alias',
    required: true,
    description: `alias domain to add as CNAME record, e.g. cloudfront the domain`
  }
]
