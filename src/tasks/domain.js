import * as r53 from '../lib/route53'

export const connect = {
  title: 'Connect dns entry',
  task: async (ctx, task) => {
    task.output = 'Checking if record exists...'
    const exists = await r53.exists(ctx.trip.name, ctx.cloudfrontDomainName)

    if (exists) {
      task.skip('DNS already set up')
      return
    }

    task.output = 'Insert/update dns record...'
    return r53.upsert(ctx.trip.name, ctx.cloudfrontDomainName)
  }
}
