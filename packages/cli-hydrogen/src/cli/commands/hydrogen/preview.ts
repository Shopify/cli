import {previewInWorker, previewInNode} from '../../services/preview'
import {path, cli} from '@shopify/cli-kit'
import {Command, Flags} from '@oclif/core'

export default class Preview extends Command {
  static description = 'Run a Hydrogen storefront locally in a worker environment'
  static flags = {
    ...cli.globalFlags,
    path: Flags.string({
      hidden: true,
      description: 'the path to your hydrogen storefront',
      env: 'SHOPIFY_FLAG_PATH',
    }),
    port: Flags.string({
      char: 'p',
      hidden: true,
      description: 'the port to run the preview server on',
      default: '3000',
      env: 'SHOPIFY_FLAG_PORT',
    }),
    target: Flags.string({
      char: 't',
      description: 'the target environment (worker or node)',
      options: ['node', 'worker'],
      default: 'worker',
      env: 'SHOPIFY_FLAG_PREVIEW_TARGET',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Preview)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()
    const port = parseInt(flags.port, 10)

    if (flags.target === 'worker') {
      await previewInWorker({directory, port})
    } else if (flags.target === 'node') {
      await previewInNode({directory, port})
    }
  }
}
