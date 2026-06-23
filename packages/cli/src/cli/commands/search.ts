import {searchService} from '../services/commands/search.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Args} from '@oclif/core'

export default class Search extends Command {
  static description =
    'Search shopify.dev for the most relevant content matching a query. Best for discovery — surfacing the relevant pieces of documentation for a topic, rather than retrieving a whole document. To download a full document verbatim, use `doc fetch`.'

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
  }

  async run(): Promise<void> {
    const {args} = await this.parse(Search)
    await searchService(args.query)
  }
}
