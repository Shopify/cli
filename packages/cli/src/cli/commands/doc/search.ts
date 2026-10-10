import {docSearchService} from '../../services/commands/doc/search.js'
import {presentDocSearchResult} from '../../services/commands/doc/search-result.js'
import {docSearchJsonOutputSchema} from '../../services/commands/doc/types.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'

export default class DocSearch extends Command {
  static descriptionWithMarkdown =
    'Query the shopify.dev vector store and print the most relevant documentation chunks as JSON. Best for programmatic discovery — surfacing the relevant pieces of documentation for a topic, rather than retrieving a whole document. To download a full document verbatim, use `doc fetch`.'

  static description = this.descriptionForHelp()

  static examples = [
    `# search shopify.dev for a topic
    shopify doc search --query "subscribe to webhooks"

    # narrow the search to a specific API and version
    shopify doc search --query "create a product" --api-name admin --api-version latest`,
    `# return typed documentation results as a JSON object
shopify doc search --query "subscribe to webhooks" --json`,
  ]

  static flags = {
    ...globalFlags,
    ...jsonFlag,
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

  static get jsonOutputSchema() {
    return docSearchJsonOutputSchema
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(DocSearch)
    const result = await docSearchService(flags.query, flags['api-name'], flags['api-version'])
    presentDocSearchResult(result, flags.json ? 'json' : 'text')
  }
}
