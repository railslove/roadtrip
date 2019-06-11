import { last } from 'lodash'
import minimatch from 'minimatch'
import objectHash from 'object-hash'

const cloudfrontMaxAge = 60 * 60 * 24 * 365 // 1 year

const defaultCacheControlRules = {
  '**/*': `public, max-age=0, must-revalidate`,
  '**/*.html': `private, max-age=0, no-cache, no-store, must-revalidate`
}

export function getCacheControl(path, customCacheControlRules = {}) {
  const cacheControlRules = {
    ...defaultCacheControlRules,
    ...customCacheControlRules
  }

  const patterns = Object.keys(cacheControlRules)
  const matchingPattern = patterns.filter(pattern => minimatch(path, pattern))
  let cacheControl = cacheControlRules[last(matchingPattern)]

  if (!cacheControl) return undefined

  // Add s-maxage directive for cloudfront to custom rules
  if (!cacheControl.includes('s-maxage')) {
    cacheControl += `, s-maxage=${cloudfrontMaxAge}`
  }

  return cacheControl
}

export function generateCacheHash(cacheRules) {
  return objectHash(cacheRules)
}
