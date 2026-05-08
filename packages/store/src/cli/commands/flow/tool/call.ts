import {callFlowTool} from '../../../services/flow/tool-call.js'
import StoreCommand from '../../../utilities/store-command.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {outputResult} from '@shopify/cli-kit/node/output'
import {resolvePath} from '@shopify/cli-kit/node/path'
import {Args, Flags} from '@oclif/core'

export default class FlowToolCall extends StoreCommand {
  static summary = 'Call a Shopify Flow tool.'

  static descriptionWithMarkdown = `Calls a Shopify Flow tool for the specified store.

The CLI owns authentication and backend routing. Agents and scripts should use this command rather than calling Flow or Sidekick endpoints directly.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> flow_app_agent_template_search --store shop.myshopify.com --arguments \'{"search_queries":["fraud prevention"]}\' --json',
    '<%= config.bin %> <%= command.id %> flow_app_agent_create_or_update_workflow_from_json --store shop.myshopify.com --arguments-file ./workflow.json --json',
  ]

  static args = {
    tool: Args.string({
      description: 'The Flow tool name to call.',
      required: true,
    }),
  }

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    store: Flags.string({
      char: 's',
      description: 'The myshopify.com domain of the store to execute against.',
      env: 'SHOPIFY_FLAG_STORE',
      parse: async (input) => normalizeStoreFqdn(input),
      required: true,
    }),
    arguments: Flags.string({
      description: 'The JSON object arguments for the tool.',
      env: 'SHOPIFY_FLAG_FLOW_TOOL_ARGUMENTS',
      exactlyOne: ['arguments', 'arguments-file'],
    }),
    'arguments-file': Flags.string({
      description: "Path to a file containing the tool arguments as JSON. Can't be used with --arguments.",
      env: 'SHOPIFY_FLAG_FLOW_TOOL_ARGUMENTS_FILE',
      parse: async (input) => resolvePath(input),
      exactlyOne: ['arguments', 'arguments-file'],
    }),
    endpoint: Flags.string({
      description: 'Override the Flow tool gateway endpoint. Intended for local development.',
      env: 'SHOPIFY_FLOW_TOOL_CALL_ENDPOINT',
      hidden: true,
    }),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(FlowToolCall)

    const result = await callFlowTool({
      tool: args.tool,
      store: flags.store,
      arguments: flags.arguments,
      argumentsFile: flags['arguments-file'],
      endpoint: flags.endpoint,
    })

    outputResult(JSON.stringify(result, null, 2))
  }
}
