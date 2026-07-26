import {authenticateStoreWithApp} from '../../services/store/auth/index.js'
import {createStoreAuthPresenter} from '../../services/store/auth/result.js'
import {promptForStoreAuthScopes} from '../../prompts/store.js'
import StoreCommand from '../../utilities/store-command.js'
import {storeFlags} from '../../flags.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {isTTY} from '@shopify/cli-kit/node/ui'
import {AbortError} from '@shopify/cli-kit/node/error'
import {Flags} from '@oclif/core'

export default class StoreAuth extends StoreCommand {
  static summary = 'Authenticate an app against a store for store commands.'

  static descriptionWithMarkdown = `Authenticates the app against the specified store for store commands and stores an online access token for later reuse.

Re-run this command if the stored token is missing, expires, or no longer has the scopes you need.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com --scopes read_products,write_products',
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com --scopes read_products,write_products --json',
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com',
  ]

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    store: storeFlags.store,
    scopes: Flags.string({
      description:
        'Comma-separated Shopify API access scopes to request for the app. If omitted, an interactive picker is shown.',
      env: 'SHOPIFY_FLAG_SCOPES',
      required: false,
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(StoreAuth)

    const scopes = await this.resolveScopes(flags.scopes)

    await authenticateStoreWithApp(
      {
        store: flags.store,
        scopes,
      },
      {
        presenter: createStoreAuthPresenter(flags.json ? 'json' : 'text'),
      },
    )
  }

  // Does not pre-select the store's existing scopes as defaults: the downstream
  // mergeRequestedAndStoredScopes already unions requested + existing scopes, and fetching existing
  // scopes before the prompt would restructure this prototype's flow.
  private async resolveScopes(flagScopes: string | undefined): Promise<string> {
    if (flagScopes !== undefined) return flagScopes

    if (!isTTY()) {
      throw new AbortError(
        'The --scopes flag is required when running non-interactively.',
        'Pass --scopes as a comma-separated list of Shopify API access scopes.',
      )
    }

    const selectedScopes = await promptForStoreAuthScopes()
    if (selectedScopes.length === 0) {
      throw new AbortError('At least one scope is required.', 'Add one or more scopes to continue.')
    }

    return selectedScopes.join(',')
  }
}
