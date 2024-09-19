import {themeFlags} from '../../flags.js'
import ThemeCommand, {FlagValues} from '../../utilities/theme-command.js'
import {pull, PullFlags} from '../../services/pull.js'
import {ensureThemeStore} from '../../utilities/theme-store.js'
import {DevelopmentThemeManager} from '../../utilities/development-theme-manager.js'
import {showEmbeddedCLIWarning} from '../../utilities/embedded-cli-warning.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {useEmbeddedThemeCLI} from '@shopify/cli-kit/node/context/local'
import {execCLI2} from '@shopify/cli-kit/node/ruby'

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
  }

  static cli2Flags = ['theme', 'development', 'live', 'nodelete', 'only', 'ignore', 'force', 'development-theme-id']

  async run(): Promise<void> {
    showEmbeddedCLIWarning()
    const {flags} = await this.parse(Pull)
    const pullFlags: PullFlags = {
      path: flags.path,
      password: flags.password,
      environment: flags.environment,
      store: flags.store,
      theme: flags.theme,
      development: flags.development,
      live: flags.live,
      nodelete: flags.nodelete,
      only: flags.only,
      ignore: flags.ignore,
      force: flags.force,
    }

    if (flags.legacy) {
      await this.execLegacy()
    } else {
      await pull(pullFlags)
    }
  }

  async execLegacy() {
    const {flags} = await this.parse(Pull)
    const store = ensureThemeStore({store: flags.store})
    const adminSession = await ensureAuthenticatedThemes(store, flags.password)

    const developmentThemeManager = new DevelopmentThemeManager(adminSession)
    const developmentTheme = await (flags.development
      ? developmentThemeManager.find()
      : developmentThemeManager.fetch())

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
    const command = ['theme', 'pull', flagsForCli2.path, ...flagsToPass].filter((arg) => {
      return arg !== undefined
    })

    await execCLI2(command, {store, adminToken: adminSession.token})
  }
}
