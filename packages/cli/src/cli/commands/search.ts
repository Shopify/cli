import {searchService} from '../services/commands/search.js'
import Command from '@shopify/cli-kit/node/base-command'
import {Args} from '@oclif/core'

export default class Search extends Command {
  static description =
    'Opens shopify.dev in your browser to search the documentation using the on-site search. Intended for interactive, human use. Deprecated: if you are an agent or need results programmatically, use `doc search` instead, which returns the matching documentation as JSON.'

  // Deprecated in favor of `doc search`, which returns JSON for programmatic use.
  // The browser behavior is intentionally preserved so existing usage doesn't break;
  // oclif emits a runtime deprecation warning pointing to `doc search`.
  static state = 'deprecated'
  static deprecationOptions = {to: 'doc search'}

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
