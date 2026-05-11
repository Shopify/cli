import {loadConfig} from '../../../services/flow/project-config.js'
import {dispatchFlowTool, unwrapJsonResult} from '../../../services/flow/dispatch.js'
import StoreCommand from '../../../utilities/store-command.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputResult} from '@shopify/cli-kit/node/output'
import {Args, Flags} from '@oclif/core'

export default class FlowTypeShow extends StoreCommand {
  static summary = "Show a GraphQL type's structure (fields, arguments, return types)."

  static descriptionWithMarkdown =
    'Prints the field structure, argument signatures, and return types for a single Admin API GraphQL type. Use to understand the shape of a type before referencing its fields in workflow JSON.'

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> Product',
    '<%= config.bin %> <%= command.id %> Order --workflow-id 01HQK...',
  ]

  static args = {
    type: Args.string({description: 'The GraphQL type name to inspect.', required: true}),
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
    'workflow-id': Flags.string({
      description: "Pin the lookup to a workflow's Admin API version.",
      env: 'SHOPIFY_FLAG_FLOW_WORKFLOW_ID',
    }),
    'workflow-version': Flags.string({
      description: 'Workflow definition version (paired with --workflow-id).',
      env: 'SHOPIFY_FLAG_FLOW_WORKFLOW_VERSION',
    }),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(FlowTypeShow)

    const store = flags.store ?? (await loadConfig())?.store
    if (!store) {
      throw new AbortError('No store. Pass --store, or run `shopify flow init` to create a flow.toml.')
    }

    const toolArgs: Record<string, unknown> = {type_ref_name: args.type}
    if (flags['workflow-id']) toolArgs.workflow_id = flags['workflow-id']
    if (flags['workflow-version']) toolArgs.workflow_version = flags['workflow-version']

    const response = await dispatchFlowTool({
      name: 'flow_app_agent_object_type_definition_search',
      source: 'flow',
      store,
      args: toolArgs,
    })

    outputResult(JSON.stringify(unwrapJsonResult(response), null, 2))
  }
}
