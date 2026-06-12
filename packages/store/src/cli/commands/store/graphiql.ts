import {openStoreGraphiQL} from '../../services/store/execute/graphiql.js'
import StoreCommand from '../../utilities/store-command.js'
import {storeFlags} from '../../flags.js'
import {globalFlags, portFlag} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'

export default class StoreGraphiQL extends StoreCommand {
  static summary = 'Open a local GraphiQL UI for a store.'

  static descriptionWithMarkdown = `Opens an authenticated Admin API GraphiQL UI for the specified store using previously stored app authentication.

Run \`shopify store auth\` first to create stored auth for the store.

Mutations are disabled by default. Re-run with \`--allow-mutations\` if you intend to modify store data.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com',
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com --allow-mutations',
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com --port 9123',
  ]

  static flags = {
    ...globalFlags,
    store: storeFlags.store,
    port: portFlag({
      description: 'Local port for the GraphiQL server.',
      env: 'SHOPIFY_FLAG_PORT',
    }),
    'allow-mutations': Flags.boolean({
      description: 'Allow GraphQL mutations to run against the target store.',
      env: 'SHOPIFY_FLAG_ALLOW_MUTATIONS',
      default: false,
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

  public async run(): Promise<void> {
    const {flags} = await this.parse(StoreGraphiQL)

    await openStoreGraphiQL({
      store: flags.store,
      port: flags.port,
      allowMutations: flags['allow-mutations'],
      variables: flags.variables,
      apiVersion: flags.version,
    })
  }
}
