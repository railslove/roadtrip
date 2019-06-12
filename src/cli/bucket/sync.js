import TripCommand from '../../command'
import * as bucket from '../../tasks/bucket'

export default class BucketSyncCommand extends TripCommand {
  async run() {
    const ctx = await this.runTasks([bucket.sync])
    this.log(`=> S3 bucket domain: ${ctx.bucketDomainName}`)
  }
}

BucketSyncCommand.description = `syncs the project to the s3 bucket
Checks which files have changed and creates/updates/deletes them in the bucket.
`
