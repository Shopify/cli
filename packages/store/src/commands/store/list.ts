import {BaseBDCommand} from '../../lib/base-command.js'
import {list} from '../../services/store/list.js'

export default class List extends BaseBDCommand {
  static summary = 'List your development stores.'
  static description = 'Display a list of development stores in your organization.'

  async runCommand(): Promise<void> {
    await list()
  }
}
