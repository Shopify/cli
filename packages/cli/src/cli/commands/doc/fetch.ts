import {docFetchService} from '../../services/commands/doc/fetch.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'

export default class DocFetch extends Command {
  static description =
    'Download a complete document from shopify.dev. Every page on shopify.dev has a Markdown version, and that is what this tool returns. Use this to pull an entire document verbatim — for example, a set of instructions an agent follows like a centrally-served skill. Pass `--language` for the language of the app you are building so code examples match your stack. For finding the relevant pieces of content across shopify.dev instead, use `doc search`.'

  static examples = [
    `# fetch the Markdown version of a Shopify.dev page
shopify doc fetch --url https://shopify.dev/docs/api/shopify-cli`,
    `# filter code examples to the language of the app you are building
shopify doc fetch --url https://shopify.dev/docs/api/shopify-cli --language ruby`,
    `# save the document to a file instead of printing it
shopify doc fetch --url https://shopify.dev/docs/api/shopify-cli --output docs/shopify-cli.md`,
  ]

  static flags = {
    ...globalFlags,
    url: Flags.string({
      description: 'The shopify.dev URL to fetch.',
      env: 'SHOPIFY_FLAG_URL',
      required: true,
    }),
    language: Flags.string({
      description:
        'Filter code examples in the returned Markdown to this language. Supply the language of the app you are building so examples match your stack. Optional — if omitted, or if shopify.dev does not recognize the language for a given page, the document includes examples in every language.',
      env: 'SHOPIFY_FLAG_LANGUAGE',
      options: ['javascript', 'typescript', 'python', 'ruby', 'php', 'rust', 'curl', 'liquid', 'graphql', 'html'],
    }),
    output: Flags.string({
      description: 'Write the document to this file path instead of printing it to stdout.',
      env: 'SHOPIFY_FLAG_OUTPUT',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(DocFetch)
    await docFetchService(flags.url, flags.output, flags.language)
  }
}
