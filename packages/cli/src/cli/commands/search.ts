import {searchService} from '../services/commands/search.js'
import Command from '@shopify/cli-kit/node/base-command'
import {Args} from '@oclif/core'

export default class Search extends Command {
  static description = 'Starts a search on shopify.dev.'

  // Deprecated in favor of `agent-search`, which returns JSON for programmatic use.
  // The browser behavior below is intentionally preserved so existing usage doesn't
  // break; oclif emits a runtime deprecation warning pointing to `agent-search`.
  static state = 'deprecated'
  static deprecationOptions = {to: 'agent-search'}

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

  async run(): Promise<void> {
    const {args} = await this.parse(Search)
    await searchService(args.query)
  }
}
