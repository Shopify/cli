import {searchService} from '../services/commands/search/index.js'
import {presentSearchResult} from '../services/commands/search/result.js'
import {searchJsonOutputSchema} from '../services/commands/search/types.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {Args} from '@oclif/core'

export default class Search extends Command {
  static descriptionWithMarkdown =
    'Search shopify.dev for the most relevant content matching a query. Best for discovery — surfacing the relevant pieces of documentation for a topic, rather than retrieving a whole document. To download a full document verbatim, use `doc fetch`.'

  static description = this.descriptionForHelp()

  static usage = `search [query]`

  static examples = [
    `# open the search modal on Shopify.dev
    shopify search

    # search for a term on Shopify.dev
    shopify search <query>

    # search for a phrase on Shopify.dev
    shopify search "<a search query separated by spaces>"
    `,
  ]

  static args = {
    query: Args.string(),
  }

  static flags = {
    ...globalFlags,
    ...jsonFlag,
  }

  static get jsonOutputSchema() {
    return searchJsonOutputSchema
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(Search)
    const result = await searchService(args.query)
    await presentSearchResult(result, flags.json ? 'json' : 'text')
  }
}
