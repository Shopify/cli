import {docFetchService} from '../../services/commands/doc/fetch.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Args, Flags} from '@oclif/core'

export default class DocFetch extends Command {
  static description =
    'Download a complete document from shopify.dev. Every page on shopify.dev has a Markdown version, and that is what this tool returns. Use this to pull an entire document verbatim — for example, a set of instructions an agent follows like a centrally-served skill. For finding the relevant pieces of content across shopify.dev instead, use `doc search`.'

  static usage = `doc fetch [URL]`

  static examples = [
    `# fetch the Markdown version of a Shopify.dev page
shopify doc fetch https://shopify.dev/docs/api/shopify-cli`,
    `# save the document to a file instead of printing it
shopify doc fetch https://shopify.dev/docs/api/shopify-cli --output docs/shopify-cli.md`,
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
    output: Flags.string({
      char: 'o',
      description: 'Write the document to this file path instead of printing it to stdout.',
      env: 'SHOPIFY_FLAG_OUTPUT',
    }),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(DocFetch)
    await docFetchService(args.url, flags.output)
  }
}
