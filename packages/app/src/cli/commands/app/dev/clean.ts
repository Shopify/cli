import {linkedAppContext} from '../../../services/app-context.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {appFlags} from '../../../flags.js'
import {storeContext} from '../../../services/store-context.js'
import {devClean} from '../../../services/dev-clean.js'
import {appDevCleanJsonOutputSchema} from '../../../services/dev-clean/types.js'
import {renderDevCleanResult} from '../../../services/dev-clean/result.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'

export default class DevClean extends AppLinkedCommand {
  static summary = 'Cleans up the dev preview from the selected store.'

  static descriptionWithMarkdown = `Stop the dev preview that was started with \`shopify app dev\`.

  It restores the app's active version to the selected development store.
  `

  static jsonOutputSchema = appDevCleanJsonOutputSchema

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...jsonFlag,
    'client-id': Flags.string({
      hidden: false,
      description:
        'The Client ID of your app. Use with --config to clean up the dev preview for a different app than the one it is linked to.',
      env: 'SHOPIFY_FLAG_CLIENT_ID',
    }),
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

    const result = await devClean({appContextResult, store})
    renderDevCleanResult(result, flags.json ? 'json' : 'text')

    return {app: appContextResult.app}
  }
}
