import {themeFlags} from '../../flags.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {Flags} from '@oclif/core'
import {cli, path, ui} from '@shopify/cli-kit'
import {execCLI2} from '@shopify/cli-kit/node/ruby'
import {generateRandomNameForSubdirectory} from '@shopify/cli-kit/node/fs'

export default class Init extends ThemeCommand {
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
    path: themeFlags.path,
    'clone-url': Flags.string({
      char: 'u',
      description:
        "The Git URL to clone from. Defaults to Shopify's example theme, Dawn: https://github.com/Shopify/dawn.git",
      env: 'SHOPIFY_FLAG_CLONE_URL',
    }),
  }

  static cli2Flags = ['clone-url']

  async run(): Promise<void> {
    const {args, flags} = await this.parse(Init)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()
    const name = args.name || (await this.promptName(directory))
    const flagsToPass = this.passThroughFlags(flags, {allowedFlags: Init.cli2Flags})
    const command = ['theme', 'init', name, ...flagsToPass]
    await execCLI2(command, {
      directory,
    })
  }

  async promptName(directory: string) {
    const defaultName = await generateRandomNameForSubdirectory({suffix: 'theme', directory, family: 'creative'})

    const question: ui.Question = {
      type: 'input',
      name: 'name',
      message: 'Name of the new theme',
      default: defaultName,
    }
    const {name} = await ui.prompt([question])
    return name
  }
}
