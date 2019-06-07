import path from 'path'
import fs from 'fs-extra'
import untildify from 'untildify'
import OclifCommand, { flags } from '@oclif/command'
import Listr from 'listr'

const CONFIG_FILE_NAME = 'roadtrip.json'

class Command extends OclifCommand {
  async init() {
    this.tripconfig = {}
    const { args, flags } = this.parse(this.constructor)

    const fullConfigPath = path.resolve(untildify(flags.config))
    if (await fs.pathExists(fullConfigPath)) {
      this.tripconfig = await fs.readJSON(fullConfigPath)
    }
  }

  async runTask(tasks) {
    const listr = new Listr(tasks instanceof Array ? tasks : [tasks])
    return listr.run().catch(error => this.error(error.toString()))
  }
}

Command.flags = {
  config: flags.string({
    char: 'c',
    default: CONFIG_FILE_NAME
  })
}

export default Command
