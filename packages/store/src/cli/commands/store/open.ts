import {openStore} from '../../services/store/open.js'
import {renderOpenStoreResult} from '../../services/store/open/result.js'
import {openStoreJsonOutputSchema} from '../../services/store/open/types.js'
import StoreCommand from '../../utilities/store-command.js'
import {storeFlags} from '../../flags.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'

export default class StoreOpen extends StoreCommand {
  static summary = 'Open your Shopify store in the default web browser.'

  static descriptionWithMarkdown = `Opens the storefront for a store you have access to in your default web browser.`

  static description = this.descriptionForHelp()

  static examples = ['<%= config.bin %> <%= command.id %> --store shop.myshopify.com']

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    store: storeFlags.store,
  }

  static get jsonOutputSchema() {
    return openStoreJsonOutputSchema
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(StoreOpen)

    const result = await openStore({store: flags.store})
    renderOpenStoreResult(result, flags.json ? 'json' : 'text')
  }
}
