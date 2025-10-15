import {deleteStore} from '../../services/store/delete.js'
import Command from '@shopify/cli-kit/node/base-command'

export default class Delete extends Command {
  static summary = 'Delete a dev store.'
  static description = 'Delete a dev store from your organization.'

  async run(): Promise<void> {
    await deleteStore()
  }
}
