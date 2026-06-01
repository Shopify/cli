import {searchShopifyDevDocs} from '../../services/docs/search.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {outputInfo, outputResult} from '@shopify/cli-kit/node/output'
import {Args, Flags} from '@oclif/core'

export default class DocsSearch extends Command {
  static summary = 'Search Shopify developer documentation.'

  static descriptionWithMarkdown = `Searches Shopify developer documentation using the same Shopify.dev assistant endpoint used by generated agent skills.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> "inventorySetQuantities required scopes" --api admin --json',
    '<%= config.bin %> <%= command.id %> "checkout UI extension buyer journey intercept" --json',
  ]

  static args = {
    query: Args.string({description: 'Search query.', required: true}),
  }

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    api: Flags.string({
      description: 'Optional Shopify API/topic name to scope results, matching ai-toolkit api_name.',
      env: 'SHOPIFY_FLAG_API',
    }),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(DocsSearch)
    const result = await searchShopifyDevDocs({query: args.query, apiName: flags.api})

    if (flags.json) {
      outputResult(JSON.stringify(result, null, 2))
      return
    }

    outputInfo(typeof result === 'string' ? result : JSON.stringify(result, null, 2))
  }
}
