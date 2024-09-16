import {themeFlags} from '../../flags.js'
import {ensureThemeStore} from '../../utilities/theme-store.js'
import ThemeCommand, {FlagValues} from '../../utilities/theme-command.js'
import {DevelopmentThemeManager} from '../../utilities/development-theme-manager.js'
import {showEmbeddedCLIWarning} from '../../utilities/embedded-cli-warning.js'
import {pull} from '../../services/pull.js'
import {findOrSelectTheme} from '../../utilities/theme-selector.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {execCLI2} from '@shopify/cli-kit/node/ruby'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {useEmbeddedThemeCLI} from '@shopify/cli-kit/node/context/local'

export default class Pull extends ThemeCommand {
  static summary = 'Download your remote theme files locally.'

  static descriptionWithMarkdown = `Retrieves theme files from Shopify.

If no theme is specified, then you're prompted to select the theme to pull from the list of the themes in your store.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...themeFlags,
    theme: Flags.string({
      char: 't',
      description: 'Theme ID or name of the remote theme.',
      env: 'SHOPIFY_FLAG_THEME_ID',
    }),
    development: Flags.boolean({
      char: 'd',
      description: 'Pull theme files from your remote development theme.',
      env: 'SHOPIFY_FLAG_DEVELOPMENT',
    }),
    live: Flags.boolean({
      char: 'l',
      description: 'Pull theme files from your remote live theme.',
      env: 'SHOPIFY_FLAG_LIVE',
    }),
    nodelete: Flags.boolean({
      char: 'n',
      description: 'Runs the pull command without deleting local files.',
      env: 'SHOPIFY_FLAG_NODELETE',
    }),
    only: Flags.string({
      char: 'o',
      multiple: true,
      description: 'Download only the specified files (Multiple flags allowed).',
      env: 'SHOPIFY_FLAG_ONLY',
    }),
    ignore: Flags.string({
      char: 'x',
      multiple: true,
      description: 'Skip downloading the specified files (Multiple flags allowed).',
      env: 'SHOPIFY_FLAG_IGNORE',
    }),
    force: Flags.boolean({
      hidden: true,
      char: 'f',
      description: 'Proceed without confirmation, if current directory does not seem to be theme directory.',
      env: 'SHOPIFY_FLAG_FORCE',
    }),
    legacy: Flags.boolean({
      hidden: true,
      description: 'Use the legacy Ruby implementation for the `shopify theme pull` command.',
      env: 'SHOPIFY_FLAG_LEGACY',
    }),
  }

  static cli2Flags = ['theme', 'development', 'live', 'nodelete', 'only', 'ignore', 'force', 'development-theme-id']

  async run(): Promise<void> {
    showEmbeddedCLIWarning()

    const {flags} = await this.parse(Pull)
    const store = ensureThemeStore(flags)
    const adminSession = await ensureAuthenticatedThemes(store, flags.password)

    const developmentThemeManager = new DevelopmentThemeManager(adminSession)
    const developmentTheme = await (flags.development
      ? developmentThemeManager.find()
      : developmentThemeManager.fetch())

    if (!flags.legacy) {
      const {path, nodelete, live, development, only, ignore, force} = flags

      const theme = await findOrSelectTheme(adminSession, {
        header: 'Select a theme to open',
        filter: {
          live,
          theme: development ? `${developmentTheme?.id}` : flags.theme,
        },
      })

      await pull(theme, adminSession, {path, nodelete, only, ignore, force})

      return
    }

    const flagsForCli2 = flags as typeof flags & FlagValues

    if (developmentTheme) {
      if (flagsForCli2.development) {
        flagsForCli2.theme = `${developmentTheme.id}`
        flagsForCli2.development = false
      }
      if (useEmbeddedThemeCLI()) {
        flagsForCli2['development-theme-id'] = developmentTheme.id
      }
    }

    const flagsToPass = this.passThroughFlags(flagsForCli2, {allowedFlags: Pull.cli2Flags})
    const command = ['theme', 'pull', flagsForCli2.path, ...flagsToPass]

    await execCLI2(command, {store, adminToken: adminSession.token})
  }
}
