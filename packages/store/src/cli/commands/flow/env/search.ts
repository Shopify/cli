import {loadConfig} from '../../../services/flow/project-config.js'
import {dispatchFlowTool, unwrapJsonResult} from '../../../services/flow/dispatch.js'
import StoreCommand from '../../../utilities/store-command.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputResult} from '@shopify/cli-kit/node/output'
import {Args, Flags} from '@oclif/core'

const DATA_TYPE_FILTERS = ['LIST', 'ALL'] as const
type DataTypeFilter = (typeof DATA_TYPE_FILTERS)[number]

export default class FlowEnvSearch extends StoreCommand {
  static summary = 'Discover Flow environment field paths.'

  static descriptionWithMarkdown = `Searches the Flow environment for field paths under a given Admin API root type. Use this before writing conditions, Liquid, or task config that reference \`{{ order.customer.email }}\`-style paths.

Pass a single root_type and search term as positional args. Use \`--workflow-id\` to pin the search to a specific workflow's Admin API version.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> Order "customer email"',
    '<%= config.bin %> <%= command.id %> Product tags --data-type LIST',
  ]

  static args = {
    'root-type': Args.string({
      description: "The Admin API type name to search within (e.g. 'Order', 'Product', 'Customer').",
      required: true,
    }),
    'search-term': Args.string({
      description: "The search term to look for (e.g. 'email', 'customer name of order').",
      required: true,
    }),
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
    'data-type': Flags.string({
      description: "Filter by data type. 'LIST' for array paths only, 'ALL' for all scalar-ending types.",
      options: [...DATA_TYPE_FILTERS],
      default: 'ALL',
    }),
    'workflow-id': Flags.string({
      description: "Pin the search to a workflow's Admin API version.",
      env: 'SHOPIFY_FLAG_FLOW_WORKFLOW_ID',
    }),
    'workflow-version': Flags.string({
      description: 'Workflow definition version (paired with --workflow-id).',
      env: 'SHOPIFY_FLAG_FLOW_WORKFLOW_VERSION',
    }),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(FlowEnvSearch)

    const store = flags.store ?? (await loadConfig())?.store
    if (!store) {
      throw new AbortError('No store. Pass --store, or run `shopify flow init` to create a flow.toml.')
    }

    const toolArgs: Record<string, unknown> = {
      searches: [{root_type: args['root-type'], search_term: args['search-term']}],
      data_type_filter: flags['data-type'] as DataTypeFilter,
    }
    if (flags['workflow-id']) toolArgs.workflow_id = flags['workflow-id']
    if (flags['workflow-version']) toolArgs.workflow_version = flags['workflow-version']

    const response = await dispatchFlowTool({
      name: 'flow_app_agent_environment_paths_search',
      source: 'flow',
      store,
      args: toolArgs,
    })

    outputResult(JSON.stringify(unwrapJsonResult(response), null, 2))
  }
}
