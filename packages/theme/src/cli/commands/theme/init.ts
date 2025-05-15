import {themeFlags} from '../../flags.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {
  cloneRepoAndCheckoutLatestTag,
  cloneRepo,
  getSkeletonThemeLatestTag,
  SKELETON_THEME_URL,
  DAWN_URL,
} from '../../services/init.js'
import {Args, Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {generateRandomNameForSubdirectory} from '@shopify/cli-kit/node/fs'
import {renderTextPrompt} from '@shopify/cli-kit/node/ui'
import {joinPath} from '@shopify/cli-kit/node/path'

export default class Init extends ThemeCommand {
  static summary = 'Clones a Git repository to use as a starting point for building a new theme.'

  static descriptionWithMarkdown = `Clones a Git repository to your local machine to use as the starting point for building a theme.

  If no Git repository is specified, then this command creates a copy of Shopify's example theme, with the specified name in the current folder. If no name is provided, then you're prompted to enter one.

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
      description: `The Git URL to clone from. Defaults to Shopify's example theme.`,
      env: 'SHOPIFY_FLAG_CLONE_URL',
      required: false,
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
    let repoUrl = flags['clone-url']

    if (!repoUrl) {
      const skeletonThemeLatestTag = await getSkeletonThemeLatestTag()

      if (skeletonThemeLatestTag) {
        repoUrl = SKELETON_THEME_URL
      } else {
        repoUrl = DAWN_URL
      }
    }

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
