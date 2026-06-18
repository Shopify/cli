import {getStoreInfo} from '../../services/store/info/index.js'
import {renderStoreInfoResult} from '../../services/store/info/result.js'
import StoreCommand from '../../utilities/store-command.js'
import {storeFlags} from '../../flags.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'

export default class StoreInfo extends StoreCommand {
  static summary = 'Surface metadata about a Shopify store.'

  static descriptionWithMarkdown = `Returns available metadata about a store you have access to, such as its id, display name, subdomain, organization, store owner, type, plan, feature preview, and admin URL.

Some details may be omitted when they are not available for the store.

Use \`--json\` for machine-readable output.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com',
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com --json',
  ]

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    store: storeFlags.store,
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(StoreInfo)

    const result = await getStoreInfo({store: flags.store})

    renderStoreInfoResult(result, flags.json ? 'json' : 'text')
  }
}
