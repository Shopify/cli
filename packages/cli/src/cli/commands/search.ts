import {searchService} from '../services/commands/search.js'
import Command from '@shopify/cli-kit/node/base-command'
import {Args} from '@oclif/core'

export default class Search extends Command {
  static description = 'Starts a search on shopify.dev.'

  static args = {
    query: Args.string(),
  }

  async run(): Promise<void> {
    const {args} = await this.parse(Search)
    await searchService(args.query)
  }
}
