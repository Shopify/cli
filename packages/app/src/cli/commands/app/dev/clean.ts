import {linkedAppContext} from '../../../services/app-context.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {appFlags} from '../../../flags.js'
import {storeContext} from '../../../services/store-context.js'
import {devClean} from '../../../services/dev-clean.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'

export default class DevClean extends AppLinkedCommand {
  static summary = 'Cleans up the app preview from the selected store.'

  static descriptionWithMarkdown = `Stop the app preview that was started with \`shopify app dev\`.

  It restores the app's active version to the selected development store.
  `

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
    store: Flags.string({
      hidden: false,
      char: 's',
      description: 'Store URL. Must be an existing development store.',
      env: 'SHOPIFY_FLAG_STORE',
      parse: async (input) => normalizeStoreFqdn(input),
    }),
  }

  public async run(): Promise<AppLinkedCommandOutput> {
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

    await devClean({appContextResult, store})

    return {app: appContextResult.app}
  }
}
