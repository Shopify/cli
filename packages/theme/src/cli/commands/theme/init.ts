import {Command, Flags} from '@oclif/core'
import {ruby} from '@shopify/cli-kit'

export default class Init extends Command {
  static description = 'Clones a Git repository to use as a starting point for building a new theme.'

  static args = [{name: 'name', description: 'Name of the new theme', required: false}]

  static flags = {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'clone-url': Flags.string({
      char: 'u',
      description:
        "The Git URL to clone from. Defaults to Shopify's example theme, Dawn: https://github.com/Shopify/dawn.git",
      env: 'SHOPIFY_FLAG_CLONE_URL',
    }),
  }

  async run(): Promise<void> {
    const command = ['theme', 'init'].concat(this.argv)
    await ruby.execCLI(command)
  }
}
