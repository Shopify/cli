import {listStores} from '../../services/store/list.js'
import {writeStoreListResult} from '../../services/store/list/result.js'
import {storeTypeFilters, type StoreTypeFilter} from '../../services/store/store-type.js'
import {storeFlags} from '../../flags.js'
import StoreCommand from '../../utilities/store-command.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'

export default class StoreList extends StoreCommand {
  static summary = 'List stores in a Shopify organization.'

  static descriptionWithMarkdown = `Lists stores in a Shopify organization available to the current CLI account.

When more than one organization is available, the command prompts you to pick one unless you provide \`--organization-id\`. In that case, \`--organization-id\` is required in non-interactive environments.

Run \`<%= config.bin %> organization list\` to find organization IDs.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --organization-id 1234567',
    '<%= config.bin %> <%= command.id %> --type dev',
    '<%= config.bin %> <%= command.id %> --json',
  ]

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    'organization-id': Flags.integer({
      description: `${storeFlags['organization-id'].description} Required if non interactive when more than one organization is available.`,
      env: 'SHOPIFY_FLAG_ORGANIZATION_ID',
    }),
    type: Flags.string({
      description: 'List only stores of this type.',
      options: storeTypeFilters,
      env: 'SHOPIFY_FLAG_STORE_TYPE',
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(StoreList)
    const result = await listStores({
      organizationId: flags['organization-id'],
      // oclif validates the value against `storeTypeFilters`, so the cast is safe.
      storeType: flags.type as StoreTypeFilter | undefined,
    })

    writeStoreListResult(result, flags.json ? 'json' : 'text')
  }
}
