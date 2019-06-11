import chalk from 'chalk'
import { flags } from '@oclif/command'
import TripCommand from '../../command'

import * as bucket from '../../tasks/bucket'
import * as distribution from '../../tasks/distribution'
import * as domain from '../../tasks/domain'

export default class ProjectDeployCommand extends TripCommand {
  async run() {
    const { flags } = this.parse(ProjectDeployCommand)
    const tasks = [
      bucket.create,
      bucket.website,
      bucket.sync,
      distribution.create,
      distribution.invalidate
    ]

    if (flags.connectDomain) {
      tasks.push(domain.connect)
    }

    const ctx = await this.runTasks(tasks)
    this.log('') // cosmetic line break

    if (ctx.cloudfrontJustCreated) {
      this.log(chalk`{bold Note:} The distribution was just set up.`)
      this.log('It can take up to 10-20 minutes to be fully available.')
      this.log('')
    }

    this.log(`=> CloudFront domain: ${ctx.cloudfrontDomainName}`)
  }
}

ProjectDeployCommand.description = `deploys the project
Creates a bucket and uploads files onto it. Creates and configures a CloudFront distribution and links it to your domain.
This task is idempotent. You can run it again to update the site.
`

ProjectDeployCommand.flags = {
  ...TripCommand.flags,
  connectDomain: flags.boolean({
    default: false,
    description: 'also connect domain on route53'
  })
}
