import {loadConfig} from '../../../services/flow/project-config.js'
import {dispatchFlowTool} from '../../../services/flow/dispatch.js'
import StoreCommand from '../../../utilities/store-command.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputResult} from '@shopify/cli-kit/node/output'
import {Args, Flags} from '@oclif/core'

const RESOURCE_TYPES = [
  'PRODUCT',
  'PRODUCT_VARIANT',
  'CUSTOMER',
  'SEGMENT',
  'COLLECTION',
  'ORDER',
  'DRAFT_ORDER',
  'APP_INSTALLATION',
  'ARTICLE',
  'BLOG',
  'PAGE',
  'DISCOUNT',
  'LOCATION',
  'MARKETING_AUTOMATION',
  'METAOBJECT_DEFINITION',
  'METAOBJECT',
  'COMPANY',
  'COMPANY_LOCATION',
  'PRODUCT_NETWORK_ORDER',
] as const

export default class FlowResourceSearch extends StoreCommand {
  static summary = 'Search for a Shopify resource by query (Sidekick-routed).'

  static descriptionWithMarkdown = `Searches the Admin API for a specific resource type. Returns title, GID, and path. \`PRODUCT_VARIANT\` also returns inventory_item_id; \`LOCATION\` also returns inventory_group_id and inventory_group_name.

Routes through Sidekick — uses the \`shop.admin.graphql\` Identity scope, not Flow's own scope.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> PRODUCT shoes',
    '<%= config.bin %> <%= command.id %> CUSTOMER "" --limit 5',
  ]

  static args = {
    type: Args.string({
      description: 'Resource type to search.',
      required: true,
      options: [...RESOURCE_TYPES],
    }),
    query: Args.string({
      description: 'Query string. Wildcards (* or ?) are not supported. Empty string returns up to --limit.',
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
    limit: Flags.integer({
      description: 'Number of resources to return (default 10, max 50).',
      min: 1,
      max: 50,
    }),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(FlowResourceSearch)

    const store = flags.store ?? (await loadConfig())?.store
    if (!store) {
      throw new AbortError('No store. Pass --store, or run `shopify flow init` to create a flow.toml.')
    }

    const toolArgs: Record<string, unknown> = {
      resource_type: args.type,
      query: args.query,
    }
    if (flags.limit !== undefined) toolArgs.limit = flags.limit

    const result = await dispatchFlowTool({
      name: 'flow_app_agent_search_shop_resource',
      source: 'sk',
      store,
      args: toolArgs,
    })

    outputResult(JSON.stringify(result, null, 2))
  }
}
