import {searchService} from '../services/commands/search.js'
import Command from '@shopify/cli-kit/node/base-command'
import {Args} from '@oclif/core'

export default class Search extends Command {
  static description = 'Starts a search on shopify.dev.'

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

  async run(): Promise<void> {
    const {args} = await this.parse(Search)
    await searchService(args.query)
  }
}
