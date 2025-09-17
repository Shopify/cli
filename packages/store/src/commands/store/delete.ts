import {BaseBDCommand} from '../../lib/base-command.js'
import {deleteStore} from '../../services/store/delete.js'

export default class Delete extends BaseBDCommand {
  static summary = 'Delete a dev store.'
  static description = 'Delete a dev store from your organization.'

  async runCommand(): Promise<void> {
    await deleteStore()
  }
}
