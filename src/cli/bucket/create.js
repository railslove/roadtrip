import TripCommand from '../../command'
import * as bucket from '../../tasks/bucket'

export default class BucketCreateCommand extends TripCommand {
  async run() {
    await this.runTasks([bucket.create])
  }
}

BucketCreateCommand.description = `create roadtrip s3 bucket
Creates a bucket with the name of the site. Does nothing if the bucket already exists.
`
