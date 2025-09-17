import {BaseBDCommand} from '../../lib/base-command.js'
import {create} from '../../services/store/create.js'

export default class Create extends BaseBDCommand {
  static summary = 'List your development stores.'
  static description = 'Display a list of development stores in your organization.'

  async runCommand(): Promise<void> {
    await create()
  }
}
