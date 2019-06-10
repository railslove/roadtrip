import Listr from 'listr'
import chalk from 'chalk'
import TripCommand from '../lib/command'
import BucketCommand from './bucket'
import DistributionCommand from './distribution'
import DomainCommand from './domain'

export default class ProjectCommand extends TripCommand {
  async run() {
    const { args, flags } = this.parse(ProjectCommand)

    const ctx = {
      siteName: this.siteName,
      projectDir: this.projectDir,
      dir: this.tripconfig.dir || flags.dir,
      indexFile: this.tripconfig.indexFile || flags.indexFile,
      errorFile: this.tripconfig.errorFile || flags.errorFile
    }

    const tasks = new Listr(ProjectCommand.getTasks(args.action))
    const outCtx = await tasks
      .run(ctx)
      .catch(error => this.error(error.toString()))

    if (!outCtx.cloudfrontExisted) {
      this.log(
        chalk`{bold Note:} The distribution was just set up. It can take up to 10-20 minutes to be fully available.`
      )
      this.log('')
    }

    this.log('URL of your distribution:')
    this.log(`  https://${outCtx.cloudfrontDomainName}`)
    this.log('URL of your page:')
    this.log(`  https://${this.siteName}`)
  }

  static getTasks(action) {
    switch (action) {
      case 'deploy':
        return [
          ...BucketCommand.getTasks('setup'),
          ...DistributionCommand.getTasks('setup'),
          ...DomainCommand.getTasks('create')
        ]
      default:
        return []
    }
  }
}

ProjectCommand.description = `manage the roadtrip project
Perform all actions for your roadtrip project.

deploy:
Runs 'bucket setup', 'distribution setup' and 'domain create' consecutively.
Creates a bucket and uploads files onto it. Then it creates and configures a CloudFront CDN and links it to your domain.
This task is idempotent. You can run it again to update your site.
`

ProjectCommand.args = [
  {
    name: 'action',
    required: true,
    options: ['deploy'],
    description: 'actions to control the project'
  }
]

ProjectCommand.flags = {
  ...BucketCommand.flags,
  ...TripCommand.flags
}
