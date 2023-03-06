import {themeFlags} from '../../flags.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {cloneRepoAndCheckoutLatestTag, cloneRepo} from '../../services/init.js'
import {Args, Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {generateRandomNameForSubdirectory} from '@shopify/cli-kit/node/fs'
import {renderTextPrompt} from '@shopify/cli-kit/node/ui'
import {joinPath} from '@shopify/cli-kit/node/path'

export default class Init extends ThemeCommand {
  static description = 'Clones a Git repository to use as a starting point for building a new theme.'

  static args = {
    name: Args.string({
      name: 'name',
      description: 'Name of the new theme',
      required: false,
    }),
  }

  static flags = {
    ...globalFlags,
    path: themeFlags.path,
    'clone-url': Flags.string({
      char: 'u',
      default: 'https://github.com/Shopify/dawn.git',
      description:
        "The Git URL to clone from. Defaults to Shopify's example theme, Dawn: https://github.com/Shopify/dawn.git",
      env: 'SHOPIFY_FLAG_CLONE_URL',
    }),
    latest: Flags.boolean({
      char: 'l',
      description: 'Downloads the latest release of the `clone-url`',
      env: 'SHOPIFY_FLAG_LATEST',
    }),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(Init)
    const name = args.name || (await this.promptName(flags.path))
    const repoUrl = flags['clone-url']
    const destination = joinPath(flags.path, name)

    if (flags.latest) {
      await cloneRepoAndCheckoutLatestTag(repoUrl, destination)
    } else {
      await cloneRepo(repoUrl, destination)
    }
  }

  async promptName(directory: string) {
    const defaultName = await generateRandomNameForSubdirectory({suffix: 'theme', directory, family: 'creative'})

    return renderTextPrompt({message: 'Name of the new theme', defaultValue: defaultName})
  }
}
