import {agentSearchService} from '../services/commands/agent-search.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Args, Flags} from '@oclif/core'

export default class AgentSearch extends Command {
  static description =
    'Query the shopify.dev vector store and print the most relevant documentation chunks as JSON. Best for programmatic discovery — surfacing the relevant pieces of documentation for a topic, rather than retrieving a whole document. To download a full document verbatim, use `fetch-doc`.'

  static usage = `agent-search [query]`

  static examples = [
    `# search shopify.dev for a topic
    shopify agent-search "subscribe to webhooks"

    # narrow the search to a specific API and version
    shopify agent-search "create a product" --api-name admin --api-version latest
    `,
  ]

  static args = {
    query: Args.string({
      name: 'query',
      required: true,
      description: 'The search query.',
    }),
  }

  static flags = {
    ...globalFlags,
    'api-name': Flags.string({
      description:
        'Limit results to a specific API (for example: admin, storefront, hydrogen, functions). Unrecognized values are ignored.',
      env: 'SHOPIFY_FLAG_API_NAME',
    }),
    'api-version': Flags.string({
      description: 'Limit results to a specific API version (for example: 2025-10, latest, current).',
      env: 'SHOPIFY_FLAG_API_VERSION',
    }),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(AgentSearch)
    await agentSearchService(args.query, flags['api-name'], flags['api-version'])
  }
}
