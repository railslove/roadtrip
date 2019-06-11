import TripCommand from '../../command'
import * as bucket from '../../tasks/bucket'

export default class BucketSyncCommand extends TripCommand {
  async run() {
    await this.runTasks([bucket.sync])
  }
}

BucketSyncCommand.description = `syncs the project to the s3 bucket
Checks which files have changed and creates/updates/deletes them in the bucket.
`
