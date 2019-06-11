import TripCommand from '../../command'
import * as bucket from '../../tasks/bucket'

export default class BucketSetupCommand extends TripCommand {
  async run() {
    await this.runTasks([bucket.setup, bucket.website, bucket.sync])
  }
}

BucketSetupCommand.description = `fully setup roadtrip s3 bucket
Creates, configures and syncs a project. It runs bucket:setup, bucket:website and bucket:sync consecutively.
`
