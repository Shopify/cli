import {path, file, error} from '@shopify/cli-kit'
import {Command, Flags} from '@oclif/core'

import previewService from '../../services/preview'

export default class Preview extends Command {
  static description = 'Run a Hydrogen storefront locally in a worker environment'
  static flags = {
    path: Flags.string({
      hidden: true,
      description: 'the path to your hydrogen storefront',
    }),
    port: Flags.string({
      char: 'p',
      hidden: true,
      description: 'the port to run the preview server on',
      default: '3000',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Preview)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()
    const port = parseInt(flags.port, 10)

    if (!(await file.exists(path.resolve(directory, 'dist/worker')))) {
      // eslint-disable-next-line no-warning-comments
      // TODO(cartogram):
      // Update with loglevel https://github.com/Shopify/shopify-cli-next/issues/90
      // Add a prompt to ask if they want to build the worker and try again.
      throw new error.Abort(`Couldn't find worker build. Run "yarn build" in ${directory}, and try again.`)
    }

    await previewService({directory, port})
  }
}
