import {openStore} from '../../services/store/open.js'
import StoreCommand from '../../utilities/store-command.js'
import {storeFlags} from '../../flags.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class StoreOpen extends StoreCommand {
  static hidden = true

  static summary = 'Open your Shopify store in the default web browser.'

  static descriptionWithMarkdown = `Opens the storefront for a store you have access to in your default web browser.`

  static description = this.descriptionWithoutMarkdown()

  static examples = ['<%= config.bin %> <%= command.id %> --store shop.myshopify.com']

  static flags = {
    ...globalFlags,
    store: storeFlags.store,
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(StoreOpen)

    await openStore({store: flags.store})
  }
}
