import {listStores} from '../../services/store/list/index.js'
import {writeStoreListResult} from '../../services/store/list/result.js'
import StoreCommand from '../../utilities/store-command.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'

export default class StoreList extends StoreCommand {
  static summary = 'List stores in a Shopify organization.'

  static descriptionWithMarkdown = `Lists stores in a Shopify organization available to the current CLI account.

When more than one organization is available, the command prompts you to pick one unless you provide \`--organization-id\`.
In non-interactive environments, provide \`--organization-id\`.

Run \`shopify organization list\` to find organization IDs.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --organization-id 1234567',
    '<%= config.bin %> <%= command.id %> --json',
  ]

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    'organization-id': Flags.string({
      description:
        'Filters the store list by organization. If omitted and you belong to more than one organization, you will be prompted to choose one.',
      env: 'SHOPIFY_FLAG_ORGANIZATION_ID',
      required: false,
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(StoreList)
    const result = await listStores({organizationId: flags['organization-id']})

    writeStoreListResult(result, flags.json ? 'json' : 'text')
  }
}
