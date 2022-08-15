import {themeFlags} from '../../flags.js'
import {Flags} from '@oclif/core'
import {cli, path, ui} from '@shopify/cli-kit'
import {execCLI2} from '@shopify/cli-kit/node/ruby'
import Command from '@shopify/cli-kit/node/base-command'

export default class Init extends Command {
  static description = 'Clones a Git repository to use as a starting point for building a new theme.'

  static args = [
    {
      name: 'name',
      description: 'Name of the new theme',
      required: false,
    },
  ]

  static flags = {
    ...cli.globalFlags,
    ...themeFlags,
    'clone-url': Flags.string({
      char: 'u',
      description:
        "The Git URL to clone from. Defaults to Shopify's example theme, Dawn: https://github.com/Shopify/dawn.git",
      env: 'SHOPIFY_FLAG_CLONE_URL',
    }),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(Init)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()
    const workingPath = args.name || (await this.promptName())
    const command = ['theme', 'init', path.resolve(directory, workingPath)]
    await execCLI2(command)
  }

  async promptName() {
    const question: ui.Question = {type: 'input', name: 'name', message: 'Name of the new theme'}
    const {name} = await ui.prompt([question])
    return name
  }
}
