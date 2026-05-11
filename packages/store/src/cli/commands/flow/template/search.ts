import {loadConfig} from '../../../services/flow/project-config.js'
import {dispatchFlowTool, unwrapJsonResult} from '../../../services/flow/dispatch.js'
import StoreCommand from '../../../utilities/store-command.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputResult} from '@shopify/cli-kit/node/output'
import {Args, Flags} from '@oclif/core'

export default class FlowTemplateSearch extends StoreCommand {
  static summary = 'Search Flow templates by business goal.'

  static descriptionWithMarkdown = `Searches Flow's template catalog for workflows matching one or more business goals. Pass each goal as a separate positional argument.

The result is a JSON object keyed by query, with templates and their workflow_json structures. Use a returned template's workflow_json as the starting point for a new workflow.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> "fraud prevention"',
    '<%= config.bin %> <%= command.id %> "fraud prevention" "high risk orders"',
  ]

  static args = {
    query: Args.string({description: 'Search query (one or more, space-separated).', required: true}),
  }

  static strict = false

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
    const {argv, flags} = await this.parse(FlowTemplateSearch)
    const queries = argv as string[]

    if (queries.length === 0) throw new AbortError('At least one search query is required.')

    const store = flags.store ?? (await loadConfig())?.store
    if (!store) {
      throw new AbortError('No store. Pass --store, or run `shopify flow init` to create a flow.toml.')
    }

    const response = await dispatchFlowTool({
      name: 'flow_app_agent_template_search',
      source: 'flow',
      store,
      args: {search_queries: queries},
    })

    outputResult(JSON.stringify(unwrapJsonResult(response), null, 2))
  }
}
