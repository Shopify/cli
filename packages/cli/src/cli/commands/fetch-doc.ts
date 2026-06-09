import {fetchDocService} from '../services/commands/fetch-doc.js'
import Command from '@shopify/cli-kit/node/base-command'
import {Args, Flags} from '@oclif/core'

export default class FetchDoc extends Command {
  static description = 'Fetch a document from shopify.dev. Defaults to Markdown.'

  static usage = `fetch-doc [URL]`

  static examples = [
    `# fetch the Markdown version of a Shopify.dev page
    shopify fetch-doc https://shopify.dev/docs/api/shopify-cli

    # fetch the HTML version of a Shopify.dev page
    shopify fetch-doc https://shopify.dev/docs/api/shopify-cli --content-type text/html
    `,
  ]

  static args = {
    url: Args.string({
      name: 'url',
      required: true,
      description: 'The shopify.dev URL to fetch.',
    }),
  }

  static flags = {
    'content-type': Flags.string({
      description: 'The Accept content type to request (defaults to text/markdown).',
      env: 'SHOPIFY_FLAG_CONTENT_TYPE',
    }),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(FetchDoc)
    await fetchDocService(args.url, flags['content-type'])
  }
}
