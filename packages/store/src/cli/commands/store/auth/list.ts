import {listStoreAuthSessions} from '../../../services/store/auth/list.js'
import {writeStoreAuthListResult} from '../../../services/store/auth/list-result.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'

export default class StoreAuthList extends Command {
  static summary = 'List stores authenticated directly with store auth.'

  static descriptionWithMarkdown = `Lists stores authenticated directly on this machine with \`shopify store auth\`.

Use this command to find stores that can be used with store-authenticated commands such as \`shopify store execute\`.
To list stores in a Shopify organization, run \`shopify store list\`.`

  static description = this.descriptionWithoutMarkdown()

  static examples = ['<%= config.bin %> <%= command.id %>', '<%= config.bin %> <%= command.id %> --json']

  static flags = {
    ...globalFlags,
    ...jsonFlag,
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(StoreAuthList)
    const result = listStoreAuthSessions()

    writeStoreAuthListResult(result, flags.json ? 'json' : 'text')
  }
}
