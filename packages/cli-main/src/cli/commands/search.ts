import {searchService} from '../services/search.js'
import {searchPrompt} from '../prompts/search.js'
import Command from '@shopify/cli-kit/node/base-command'

export default class Search extends Command {
  static description = 'Search docs from within the CLI'

  static args = [
    {
      name: 'query',
      required: false,
      description: 'the search query',
    },
  ]

  async run(): Promise<void> {
    console.log('From the command')
    const {
      args: {query},
    } = await this.parse(Search)
    const options = await searchPrompt({query})
    await searchService(options.query)
  }
}
