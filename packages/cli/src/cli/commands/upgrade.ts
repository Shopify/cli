import {upgrade} from '../services/upgrade.js'
import {Flags} from '@oclif/core'
import Command from '@shopify/cli-kit/node/base-command'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'
import {resolvePath, cwd} from '@shopify/cli-kit/node/path'

export default class Upgrade extends Command {
  static summary = 'Upgrade your CLI dependency.'

  static descriptionWithMarkdown =
    'If the CLI is installed as a dependency of your app project, this command will upgrade it. Otherwise, refer to the [upgrade](https://shopify.dev/docs/api/shopify-cli#upgrade) documentation.'

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    path: Flags.string({
      hidden: false,
      description: 'The path to your project directory.',
      env: 'SHOPIFY_FLAG_PATH',
      parse: async (input) => resolvePath(input),
      default: async () => cwd(),
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Upgrade)
    await upgrade(flags.path, CLI_KIT_VERSION)
  }
}
