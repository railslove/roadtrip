import chalk from 'chalk'
import TripCommand from '../../command'
import * as distribution from '../../tasks/distribution'

export default class DistributionCreateCommand extends TripCommand {
  async run() {
    const ctx = await this.runTasks([distribution.create])
    this.log('') // cosmetic line break

    if (ctx.cloudfrontJustCreated) {
      this.log(chalk`{bold Note:} The distribution was just set up.`)
      this.log('It can take up to 10-20 minutes to be fully available.')
      this.log('')
    }

    this.log(`=> CloudFront domain: ${ctx.cloudfrontDomainName}`)
  }
}

DistributionCreateCommand.description = `create cloudfront for project
Creates a distribution and connects it to the S3 bucket of the site. If the distribution already exists, the configuration will be updated.
It looks for a matching certificate in the Certificate Manager. If no Certificate is found, it exits with an error.
`
