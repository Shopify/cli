import {docSearchService} from '../../services/commands/doc/search.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'

export default class DocSearch extends Command {
  static description =
    'Query the shopify.dev vector store and print the most relevant documentation chunks as JSON. Best for programmatic discovery — surfacing the relevant pieces of documentation for a topic, rather than retrieving a whole document. To download a full document verbatim, use `doc fetch`.'

  static examples = [
    `# search shopify.dev for a topic
    shopify doc search --query "subscribe to webhooks"

    # narrow the search to a specific API and version
    shopify doc search --query "create a product" --api-name admin --api-version latest
    `,
  ]

  static flags = {
    ...globalFlags,
    query: Flags.string({
      description: 'The search query.',
      env: 'SHOPIFY_FLAG_QUERY',
      required: true,
    }),
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
    const {flags} = await this.parse(DocSearch)
    await docSearchService(flags.query, flags['api-name'], flags['api-version'])
  }
}
