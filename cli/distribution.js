import path from 'path'
import { flags } from '@oclif/command'
import Command from '../lib/command'
import { bucket } from '..'

class DistributionCommand extends Command {
  async run() {
    const { args, flags } = this.parse(DistributionCommand)

    const bucketName = this.tripconfig.site || flags.site
    if (!bucketName) {
      this.error('No site name configured.')
    }

    function getTask() {
      switch (args.action) {
        case 'create':
          return DistributionCommand.tasks.create(bucketName)
      }
    }

    return this.runTask(getTask())
  }
}

DistributionCommand.tasks = {
  create: siteName => ({
    title: 'Create destribution',
    task: async (ctx, task) => {
      task.output = 'Checking if distribution exists...'
      if (await cloudfront.exists(siteName)) {
        task.skip('Distribution already exists')
        return
      }

      task.output = 'Creating distribution...'
      return cloudfront.create(siteName)
    }
  })
}

DistributionCommand.description = `Describe the command here
...
Extra documentation goes here
`

DistributionCommand.args = [
  {
    name: 'action',
    required: true,
    options: ['create']
  }
]

DistributionCommand.flags = {
  ...Command.flags,
  site: flags.string({
    char: 's'
  })
}

export default DistributionCommand
