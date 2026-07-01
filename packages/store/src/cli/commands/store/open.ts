import {openStore} from '../../services/store/open.js'
import StoreCommand from '../../utilities/store-command.js'
import {storeFlags} from '../../flags.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'

export default class StoreOpen extends StoreCommand {
  static hidden = true

  static summary = 'Open your Shopify store in the default web browser.'

  static descriptionWithMarkdown = `Opens the storefront for a store you have access to in your default web browser.

Use \`--admin\` to open the Shopify admin instead. For preview stores that aren't fully set up yet, \`--admin\` first saves the store and then brings you to the admin in your browser.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com',
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com --admin',
  ]

  static flags = {
    ...globalFlags,
    store: storeFlags.store,
    admin: Flags.boolean({
      char: 'a',
      description:
        'Open the admin instead of the storefront. For a preview store, this saves the store and then opens the admin.',
      env: 'SHOPIFY_FLAG_ADMIN',
      default: false,
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(StoreOpen)

    await openStore({store: flags.store, admin: flags.admin})
  }
}
