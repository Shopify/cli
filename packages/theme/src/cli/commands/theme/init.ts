import {themeFlags} from '../../flags.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {
  cloneRepoAndCheckoutLatestTag,
  cloneRepo,
  createAIInstructions,
  SKELETON_THEME_URL,
  promptAIInstruction,
} from '../../services/init.js'
import {Args, Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {generateRandomNameForSubdirectory} from '@shopify/cli-kit/node/fs'
import {renderTextPrompt} from '@shopify/cli-kit/node/ui'
import {joinPath} from '@shopify/cli-kit/node/path'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'

export default class Init extends ThemeCommand {
  static summary = 'Clones a Git repository to use as a starting point for building a new theme.'

  static descriptionWithMarkdown = `Clones a Git repository to your local machine to use as the starting point for building a theme.

  If no Git repository is specified, then this command creates a copy of Shopify's [Skeleton theme](${SKELETON_THEME_URL}), with the specified name in the current folder. If no name is provided, then you're prompted to enter one.

  > Caution: If you're building a theme for the Shopify Theme Store, then you can use our example theme as a starting point. However, the theme that you submit needs to be [substantively different from existing themes](https://shopify.dev/docs/themes/store/requirements#uniqueness) so that it provides added value for users.
  `

  static description = this.descriptionWithoutMarkdown()

  static usage = 'theme init [name] [flags]'

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
      default: SKELETON_THEME_URL,
      description: `The Git URL to clone from. Defaults to Shopify's Skeleton theme.`,
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

    if (!terminalSupportsPrompting()) return

    const aiInstruction = await promptAIInstruction()

    if (!aiInstruction) {
      return
    }

    await createAIInstructions(destination, aiInstruction)
  }

  async promptName(directory: string) {
    const defaultName = await generateRandomNameForSubdirectory({suffix: 'theme', directory, family: 'creative'})

    return renderTextPrompt({message: 'Name of the new theme', defaultValue: defaultName})
  }
}
