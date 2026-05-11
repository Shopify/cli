import {loadConfig} from '../../../services/flow/project-config.js'
import {dispatchFlowTool, unwrapJsonResult} from '../../../services/flow/dispatch.js'
import StoreCommand from '../../../utilities/store-command.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputResult} from '@shopify/cli-kit/node/output'
import {Args, Flags} from '@oclif/core'

export default class FlowShopifyqlColumns extends StoreCommand {
  static summary = 'Resolve the columns a ShopifyQL query produces.'

  static descriptionWithMarkdown =
    'Given a ShopifyQL query string, returns the column names + types the query will produce. These are the fields Flow would add to the environment when the query runs.'

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> "FROM sales SHOW gross_sales BY product_title SINCE -7d"',
  ]

  static args = {
    query: Args.string({description: 'A ShopifyQL query string.', required: true}),
  }

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    store: Flags.string({
      char: 's',
      description: 'The myshopify.com domain. Falls back to flow.toml.',
      env: 'SHOPIFY_FLAG_STORE',
      parse: async (input) => normalizeStoreFqdn(input),
    }),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(FlowShopifyqlColumns)

    const store = flags.store ?? (await loadConfig())?.store
    if (!store) {
      throw new AbortError('No store. Pass --store, or run `shopify flow init` to create a flow.toml.')
    }

    const response = await dispatchFlowTool({
      name: 'flow_app_agent_shopifyql_query_fields',
      source: 'flow',
      store,
      args: {query: args.query},
    })

    outputResult(JSON.stringify(unwrapJsonResult(response), null, 2))
  }
}
