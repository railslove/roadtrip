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

    this.siteName = flags.siteName || this.tripconfig.siteName

    if (!this.siteName) {
      this.error('No site name configured.')
    }
  }
}

TripCommand.flags = {
  config: flags.string({
    char: 'c',
    default: CONFIG_FILE_NAME
  })
}
