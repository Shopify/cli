import {fetchDocService} from '../services/commands/fetch-doc.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Args, Flags} from '@oclif/core'

export default class FetchDoc extends Command {
  static description =
    'Download a complete document from shopify.dev. Every page on shopify.dev has a Markdown version, and that is what this tool returns by default. Use this to pull an entire document verbatim — for example, a set of instructions an agent follows like a centrally-served skill. For finding the relevant pieces of content across shopify.dev instead, use `search`.'

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
    ...globalFlags,
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
