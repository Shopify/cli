import {create} from '../../services/store/create.js'
import Command from '@shopify/cli-kit/node/base-command'

export default class Create extends Command {
  static summary = 'List your development stores.'
  static description = 'Display a list of development stores in your organization.'

  async run(): Promise<void> {
    await create()
  }
}
