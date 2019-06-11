import TripCommand from '../../command'
import * as distribution from '../../tasks/distribution'

export default class DistributionInvalidateCommand extends TripCommand {
  async run() {
    await this.runTasks([distribution.invalidate])
  }
}

DistributionInvalidateCommand.description = `invalidates the distribution's cache
`
