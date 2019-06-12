import path from 'path'
import untildify from 'untildify'
import delay from 'delay'
import * as s3 from '../lib/s3'
import * as cacheControl from '../lib/cache-control'

const debug = require('debug')('roadtrip:task:bucket')

export const create = {
  title: 'Create bucket',
  task: async (ctx, task) => {
    task.output = 'Checking if bucket exists...'
    ctx.bucketExisted = await s3.exists(ctx.trip.name)
    debug('Bucket %s exists: $s', ctx.trip.name, ctx.bucketExisted)

    if (ctx.bucketExisted) {
      task.skip('Bucket already exists')
      return
    }

    task.output = 'Creating bucket...'
    debug('Creating bucket %s', ctx.trip.name)
    return s3.create(ctx.trip.name)
  }
}

export const website = {
  title: 'Make bucket a website',
  task: async (ctx, _task) => {
    const { indexFile, errorFile } = ctx.trip
    debug('Configure bucket %s as website with %o', ctx.trip.name, {
      indexFile,
      errorFile
    })
    await s3.website(ctx.trip.name, { indexFile, errorFile })
    const bucketDomain = await s3.getDomain(ctx.trip.name)
    ctx.bucketDomainName = bucketDomain
  }
}

export const sync = {
  title: 'Sync files',
  task: async (ctx, task) => {
    if (!ctx.bucketExisted) {
      const waitSec = 5
      task.output = `Bucket was just created. Wait ${waitSec} seconds before continuing...`
      await delay(waitSec * 1000)
    }

    task.output = 'Checking if cache-control has changed...'
    const existingCacheHash = await s3.getCacheHash(ctx.trip.name)
    const nowCacheHash = cacheControl.generateCacheHash(ctx.trip.cacheControl)
    const cacheRulesChanged = existingCacheHash !== nowCacheHash

    debug('Bucket Cache Hash: %s, Current Cache Hash: %s')

    if (cacheRulesChanged) {
      debug('Cashe hashes do not match. Store new cache hash in bucket.')
      task.output = 'Cache rules have changed. Saving version on bucket...'
      await s3.setCacheHash(ctx.trip.name, nowCacheHash)
    }

    task.output = 'Syncing...'
    function onUpdate(action, key) {
      task.output = `${action}: ${key}`
    }

    const syncDir = path.resolve(ctx.trip.projectDir, untildify(ctx.trip.dir))
    debug('Syncing dir %s with bucket %s', syncDir, ctx.trip.name)

    const syncs = await s3.sync(ctx.trip.name, syncDir, {
      onUpdate,
      cacheControlRules: ctx.trip.cacheControl,
      forceAll: cacheRulesChanged
    })
    ctx.syncedFiles = syncs
    debug('Synced files finished: %O', syncs)

    if (syncs.length < 1) {
      task.skip('No files to sync')
      return
    }

    const word = syncs.length === 1 ? 'file' : 'files'
    task.title = `Synced ${syncs.length} ${word}`
  }
}
