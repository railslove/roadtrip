import path from 'path'
import fs from 'fs-extra'
import untildify from 'untildify'
import OclifCommand, { flags } from '@oclif/command'
import Listr from 'listr'

const debug = require('debug')('roadtrip:cli:base')
const CONFIG_FILE_NAME = 'roadtrip.json'

export default class TripCommand extends OclifCommand {
  async init() {
    const { flags } = this.parse(this.constructor)
    this.flags = flags

    // Try to load config file, store in `this.tripconfig`
    this.rawTripConfig = {}
    const fullConfigPath = path.resolve(untildify(flags.config))
    if (await fs.pathExists(fullConfigPath)) {
      this.rawTripConfig = await fs.readJSON(fullConfigPath)
    }

    this.trip = {
      indexFile: 'index.html',
      errorFile: '404.html',
      cacheControl: {},
      cdn: true,
      ...this.rawTripConfig,
      projectDir: path.resolve(fullConfigPath, '..'),
      name: flags.name || this.rawTripConfig.name,
      domain: flags.domains || this.rawTripConfig.domain,
      https: flags.https || this.rawTripConfig.https || false
    }

    debug('Loaded base command. data: %O', this.trip)

    if (!this.trip.name) {
      this.error('No project name found in roadtrip config file or arguments.')
    }
  }

  async runTasks(tasks, ctx = {}) {
    let renderer = 'default'

    if (this.flags.verbose || process.env.CI) {
      renderer = 'verbose'
    }

    const listr = new Listr(tasks, { renderer })
    return listr
      .run({ trip: this.trip, ...ctx })
      .catch(error => this.error(error.toString()))
  }
}

TripCommand.flags = {
  config: flags.string({
    char: 'c',
    default: CONFIG_FILE_NAME,
    description: 'path to a roadtrip configuration file'
  }),
  name: flags.string({
    char: 'n',
    description: 'name of the project'
  }),
  domain: flags.string({
    char: 'd',
    description: 'custom domain for cloudfront'
  }),
  https: flags.boolean({
    default: false,
    description: 'set up the site with https',
    allowNo: true
  }),
  verbose: flags.boolean({
    default: false,
    description: 'turn on verbose output'
  })
}
