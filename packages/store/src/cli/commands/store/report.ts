import {runStoreReport} from '../../services/store/report/index.js'
import {renderStoreReportResult} from '../../services/store/report/output.js'
import StoreCommand from '../../utilities/store-command.js'
import {storeFlags} from '../../flags.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'
import type {StoreReportApi} from '../../services/store/report/types.js'

export default class StoreReport extends StoreCommand {
  static summary = 'Turn a natural-language question into a store report.'

  static descriptionWithMarkdown = `Answers a question about a store by asking the Shopify assistant to translate it into either a \
ShopifyQL analytics query or a raw Admin API GraphQL query, running that query against the store's Admin API, and printing the results.

ShopifyQL is used for time-series and aggregate analytics questions (sales trends, order counts, and so on), while \
raw Admin GraphQL is used for catalog and store-state lookups (products, orders, customers, and so on). Use \
\`--api\` to force one or the other.

Run \`shopify store auth\` first to create stored auth for the store.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com --analysis "What were my sales last month?"',
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com --analysis "List my 5 most recent draft orders" --api admin',
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com --analysis "How many orders did I get this week?" --json',
  ]

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    store: storeFlags.store,
    analysis: Flags.string({
      description: 'The question to answer about the store, in natural language.',
      env: 'SHOPIFY_FLAG_ANALYSIS',
      required: true,
    }),
    version: Flags.string({
      description: 'The Admin API version to use. Defaults to the latest stable version.',
      env: 'SHOPIFY_FLAG_VERSION',
    }),
    api: Flags.string({
      description: 'Forces the query onto a specific API surface instead of letting the assistant choose.',
      env: 'SHOPIFY_FLAG_API',
      options: ['shopifyql', 'admin'],
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(StoreReport)

    const result = await runStoreReport({
      store: flags.store,
      analysis: flags.analysis,
      version: flags.version,
      // oclif's `options: ['shopifyql', 'admin']` already enforces this at runtime; its flag
      // types don't narrow accordingly, so this cast just reflects that guarantee.
      api: flags.api as StoreReportApi | undefined,
    })

    renderStoreReportResult(result, flags.json ? 'json' : 'text')
  }
}
