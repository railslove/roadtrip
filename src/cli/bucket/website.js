import TripCommand from '../../command'
import * as bucket from '../../tasks/bucket'

export default class BucketWebsiteCommand extends TripCommand {
  async run() {
    await this.runTasks([bucket.website])
  }
}

BucketWebsiteCommand.description = `configures the s3 bucket as website
`
