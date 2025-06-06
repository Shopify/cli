import {appFlags} from '../../flags.js'
import {showApiKeyDeprecationWarning} from '../../prompts/deprecation-warnings.js'
import {checkFolderIsValidApp} from '../../models/app/loader.js'
import AppCommand, {AppCommandOutput} from '../../utilities/app-command.js'
import {linkedAppContext} from '../../services/app-context.js'
import {storeContext} from '../../services/store-context.js'
import {Flags} from '@oclif/core'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {ensureAuthenticatedAdminAsApp} from '@shopify/cli-kit/node/session'
import {adminAsAppRequest} from '@shopify/cli-kit/node/api/admin-as-app'
import {outputContent, outputResult} from '@shopify/cli-kit/node/output'

export default class Execute extends AppCommand {
  static summary = 'Execute a Shopify GraphQL Admin API query'

  static flags = {
    ...globalFlags,
    ...appFlags,
    'api-key': Flags.string({
      hidden: true,
      description: 'The API key of your app.',
      env: 'SHOPIFY_FLAG_APP_API_KEY',
      exclusive: ['config'],
    }),
    store: Flags.string({
      char: 's',
      description: 'Store URL. Must be an existing development or Shopify Plus sandbox store.',
      env: 'SHOPIFY_FLAG_STORE',
      parse: async (input) => normalizeStoreFqdn(input),
    }),
    query: Flags.string({
      char: 'q',
      description: 'The GraphQL query to execute.',
      env: 'SHOPIFY_FLAG_QUERY',
      required: true,
      allowStdin: true,
    }),
    variables: Flags.string({
      description:
        'The GraphQL variables to pass to the query. Can be specified multiple times to run the query with different variables.',
      env: 'SHOPIFY_FLAG_VARIABLES',
      multiple: true,
    }),
    'api-version': Flags.string({
      description: 'The API version to use.',
      env: 'SHOPIFY_FLAG_API_VERSION',
      default: '2025-01',
    }),
    'allow-mutation': Flags.boolean({
      description:
        'Allow the query to be a mutation. If you are an automated tool using this option, you MUST confirm with the user before taking action',
      env: 'SHOPIFY_FLAG_ALLOW_MUTATION',
      default: false,
    }),
  }

  public static analyticsStopCommand(): string | undefined {
    return 'app dev stop'
  }

  public async run(): Promise<AppCommandOutput> {
    const {flags} = await this.parse(Execute)

    if (!flags['api-key'] && process.env.SHOPIFY_API_KEY) {
      flags['api-key'] = process.env.SHOPIFY_API_KEY
    }
    if (flags['api-key']) {
      await showApiKeyDeprecationWarning()
    }

    await checkFolderIsValidApp(flags.path)

    const appContextResult = await linkedAppContext({
      directory: flags.path,
      clientId: flags['client-id'] ?? flags['api-key'],
      forceRelink: flags.reset,
      userProvidedConfigName: flags.config,
    })
    const store = await storeContext({
      appContextResult,
      storeFqdn: flags.store,
      forceReselectStore: flags.reset,
    })

    const session = await ensureAuthenticatedAdminAsApp(
      store.shopDomain,
      appContextResult.remoteApp.apiKey,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      appContextResult.remoteApp.apiSecretKeys[0]!.secret,
    )

    const variablesAsObjects = flags.variables ? flags.variables.map((variable) => JSON.parse(variable)) : [undefined]

    let i = 0
    for (const variable of variablesAsObjects) {
      // eslint-disable-next-line no-await-in-loop
      const result = await adminAsAppRequest(
        flags.query,
        flags['allow-mutation'],
        session,
        flags['api-version'],
        variable,
      )

      if (result.status === 'blocked') {
        outputResult(outputContent`Use the --allow-mutation flag to execute mutations.`)
        return {app: appContextResult.app}
      } else {
        if (flags.variables !== undefined && flags.variables.length > 0) {
          outputResult(`${i}:`)
        }
        outputResult(outputContent`${JSON.stringify(result.data, null, 2)}`)
      }
      i++
    }

    return {app: appContextResult.app}
  }
}
