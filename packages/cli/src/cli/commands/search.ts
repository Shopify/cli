import {searchService} from '../services/search.js'
import Command from '@shopify/cli-kit/node/base-command'

export default class Search extends Command {
  static description = 'Search shopify.dev docs from within the CLI.'

  static args = [
    {
      name: 'query',
      required: false,
      description: 'the search query',
    },
  ]

  async run(): Promise<void> {
    const {
      args: {query},
    } = await this.parse(Search)
    await searchService(query)
  }
}
