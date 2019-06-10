import path from 'path'
import fs from 'fs-extra'
import untildify from 'untildify'
import OclifCommand, { flags } from '@oclif/command'

const CONFIG_FILE_NAME = 'roadtrip.json'

export default class TripCommand extends OclifCommand {
  async init() {
    this.tripconfig = {}
    const { flags } = this.parse(this.constructor)

    const fullConfigPath = path.resolve(untildify(flags.config))
    if (await fs.pathExists(fullConfigPath)) {
      this.tripconfig = await fs.readJSON(fullConfigPath)
    }

    this.projectDir = path.resolve(fullConfigPath, '..')
    this.siteName = flags.site || this.tripconfig.site

    if (!this.siteName) {
      this.error('No site name configured.')
    }
  }
}

TripCommand.flags = {
  config: flags.string({
    char: 'c',
    default: CONFIG_FILE_NAME,
    description: 'path to a roadtrip configuration file'
  }),
  site: flags.string({
    char: 's',
    description: 'domain name under which the site will be available'
  })
}
