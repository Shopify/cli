import {listStores} from '../../services/store/list.js'
import {writeStoreListResult} from '../../services/store/list/result.js'
import {storeFlags} from '../../flags.js'
import StoreCommand from '../../utilities/store-command.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'

export default class StoreList extends StoreCommand {
  static summary = 'List stores in a Shopify organization.'

  static descriptionWithMarkdown = `Lists stores in a Shopify organization available to the current CLI account.

When more than one organization is available, the command prompts you to pick one unless you provide \`--organization-id\`.
In non-interactive environments, \`--organization-id\` is required.

Run \`<%= config.bin %> organization list\` to find organization IDs.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --organization-id 1234567',
    '<%= config.bin %> <%= command.id %> --json',
  ]

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    'organization-id': storeFlags['organization-id'],
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(StoreList)
    const result = await listStores({organizationId: flags['organization-id']})

    writeStoreListResult(result, flags.json ? 'json' : 'text')
  }
}
