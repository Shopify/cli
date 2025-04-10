import {linkedAppContext} from '../../../services/app-context.js'
import AppCommand, {AppCommandOutput} from '../../../utilities/app-command.js'
import {appFlags} from '../../../flags.js'
import {storeContext} from '../../../services/store-context.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {renderSuccess} from '@shopify/cli-kit/node/ui'

export default class DevClean extends AppCommand {
  static summary = 'Cleans up the app preview from the selected store.'

  static descriptionWithMarkdown = `Stop the app preview that was started with \`shopify app dev\`.

  It restores the app active version to the selected development store.
  `

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
    store: Flags.string({
      hidden: false,
      char: 's',
      description: 'Store URL. Must be an existing development or Shopify Plus sandbox store.',
      env: 'SHOPIFY_FLAG_STORE',
      parse: async (input) => normalizeStoreFqdn(input),
    }),
  }

  public async run(): Promise<AppCommandOutput> {
    const {flags} = await this.parse(DevClean)

    const appContextResult = await linkedAppContext({
      directory: flags.path,
      clientId: flags['client-id'],
      forceRelink: flags.reset,
      userProvidedConfigName: flags.config,
    })

    const store = await storeContext({
      appContextResult,
      storeFqdn: flags.store,
      forceReselectStore: flags.reset,
    })

    const client = appContextResult.developerPlatformClient
    await client.devSessionDelete({shopFqdn: store.shopDomain, appId: appContextResult.remoteApp.id})

    renderSuccess({
      headline: 'App preview stopped.',
      body: [
        `The app preview has been stopped on "${store.shopDomain}" and the app active version has been restored.`,
        'You can start it again with `shopify app dev`.',
      ],
    })

    return {app: appContextResult.app}
  }
}
