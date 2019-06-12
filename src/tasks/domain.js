import * as r53 from '../lib/route53'

const debug = require('debug')('roadtrip:task:domain')

export const connect = {
  title: 'Connect dns entry',
  task: async (ctx, task) => {
    task.output = 'Checking if record exists...'
    const alias = ctx.cloudfrontDomainName || ctx.bucketDomainName
    const exists = await r53.exists(ctx.trip.name, alias)
    debug('Record exists and is correct: %s', exists)

    if (exists) {
      task.skip('DNS already set up')
      return
    }

    task.output = 'Insert/update dns record...'
    debug('Upsert record: %s ALIAS %s', ctx.trip.name, alias)
    return r53.upsert(ctx.trip.name, alias)
  }
}
