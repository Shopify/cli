import {prepareStoreReport, runStoreReport} from '../../services/store/report/index.js'
import {renderStoreReportResult} from '../../services/store/report/output.js'
import {REPORT_PROGRESS_TITLES, type ReportProgress} from '../../services/store/report/progress.js'
import StoreCommand from '../../utilities/store-command.js'
import {storeFlags} from '../../flags.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {outputContent} from '@shopify/cli-kit/node/output'
import {renderSingleTask} from '@shopify/cli-kit/node/ui'
import {Flags} from '@oclif/core'

export default class StoreReport extends StoreCommand {
  static summary = 'Turn a natural-language question into a store report.'

  static descriptionWithMarkdown = `Answers a question about a store by running an AI agent that translates it into either a \
ShopifyQL analytics query or a raw Admin API GraphQL query, runs that query against the store's Admin API (retrying \
and consulting the Shopify dev docs to correct itself as needed), and prints the results.

ShopifyQL is used for time-series and aggregate analytics questions (sales trends, order counts, and so on), while \
raw Admin GraphQL is used for catalog and store-state lookups (products, orders, customers, and so on). The agent \
chooses the surface that best fits the question.

Run \`shopify store auth\` first to create stored auth for the store.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com --analysis "What were my sales last month?"',
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com --analysis "List my 5 most recent draft orders"',
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
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(StoreReport)

    // Auth/context prep happens before the bar so an auth error or prompt isn't hidden behind it.
    const prepared = await prepareStoreReport({store: flags.store, version: flags.version})

    if (flags.json) {
      const report = await renderSingleTask({
        title: outputContent`${REPORT_PROGRESS_TITLES.analyzing}`,
        task: async (updateStatus) => {
          const onProgress: ReportProgress = (title) => updateStatus(outputContent`${title}`)
          return runStoreReport({prepared, analysis: flags.analysis, onProgress})
        },
        renderOptions: {stdout: process.stderr},
      })
      renderStoreReportResult(report, 'json')
      return
    }

    const {generateStoreReportSpec, presentStoreReport} = await import('../../services/store/report/ui/index.js')

    const {report, generation} = await renderSingleTask({
      title: outputContent`${REPORT_PROGRESS_TITLES.analyzing}`,
      task: async (updateStatus) => {
        const onProgress: ReportProgress = (title) => updateStatus(outputContent`${title}`)
        const report = await runStoreReport({prepared, analysis: flags.analysis, onProgress})
        onProgress(REPORT_PROGRESS_TITLES.building)
        const generation = await generateStoreReportSpec({report, ...prepared.proxyConfig})
        return {report, generation}
      },
      renderOptions: {stdout: process.stderr},
    })

    // The Ink dashboard render happens after the bar closes — a live spinner and an Ink render can't
    // coexist.
    await presentStoreReport(report, generation)
  }
}
