import {appFlags} from '../../flags.js'
import {openAppGraphiQL} from '../../services/app/graphiql.js'
import {prepareAppStoreContext} from '../../utilities/execute-command-helpers.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../utilities/app-linked-command.js'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {globalFlags, portFlag} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'

export default class AppGraphiQL extends AppLinkedCommand {
  static summary = 'Open a local GraphiQL UI for your app and store.'

  static descriptionWithMarkdown = `Opens an authenticated Admin API GraphiQL UI for your app and selected store.

The app must be installed on the store.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com',
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com --port 9123',
  ]

  static flags = {
    ...globalFlags,
    ...appFlags,
    store: Flags.string({
      char: 's',
      description:
        'The myshopify.com domain of the store to open GraphiQL against. The app must be installed on the store. If not specified, you will be prompted to select a store.',
      env: 'SHOPIFY_FLAG_STORE',
      parse: async (input) => normalizeStoreFqdn(input),
    }),
    port: portFlag({
      description: 'Local port for the GraphiQL server.',
      env: 'SHOPIFY_FLAG_PORT',
    }),
    variables: Flags.string({
      char: 'v',
      description: 'The values for any GraphQL variables in your query or mutation, in JSON format.',
      env: 'SHOPIFY_FLAG_VARIABLES',
    }),
    version: Flags.string({
      description: 'The API version to use in GraphiQL. Defaults to the latest stable version.',
      env: 'SHOPIFY_FLAG_VERSION',
    }),
  }

  public async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(AppGraphiQL)
    const {appContextResult, store} = await prepareAppStoreContext(flags)

    await openAppGraphiQL({
      remoteApp: appContextResult.remoteApp,
      store: store.shopDomain,
      port: flags.port,
      variables: flags.variables,
      apiVersion: flags.version,
    })

    return {app: appContextResult.app}
  }
}
