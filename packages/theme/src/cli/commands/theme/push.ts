import {themeFlags} from '../../flags.js'
import {ensureThemeStore} from '../../utilities/theme-store.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {DevelopmentThemeManager} from '../../utilities/development-theme-manager.js'
import {findOrSelectTheme} from '../../utilities/theme-selector.js'
import {showEmbeddedCLIWarning} from '../../utilities/embedded-cli-warning.js'
import {push} from '../../services/push.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {execCLI2} from '@shopify/cli-kit/node/ruby'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {useEmbeddedThemeCLI} from '@shopify/cli-kit/node/context/local'
import {RenderConfirmationPromptOptions, renderConfirmationPrompt, renderTextPrompt} from '@shopify/cli-kit/node/ui'
import {generateRandomNameForSubdirectory} from '@shopify/cli-kit/node/fs'
import {UNPUBLISHED_THEME_ROLE} from '@shopify/cli-kit/node/themes/utils'
import {publishTheme} from '@shopify/cli-kit/node/themes/api'

export default class Push extends ThemeCommand {
  static description =
    'Uploads your local theme files to the connected store, overwriting the remote version if specified.'

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
      description: 'Push theme files from your remote development theme.',
      env: 'SHOPIFY_FLAG_DEVELOPMENT',
    }),
    live: Flags.boolean({
      char: 'l',
      description: 'Push theme files from your remote live theme.',
      env: 'SHOPIFY_FLAG_LIVE',
    }),
    unpublished: Flags.boolean({
      char: 'u',
      description: 'Create a new unpublished theme and push to it.',
      env: 'SHOPIFY_FLAG_UNPUBLISHED',
    }),
    nodelete: Flags.boolean({
      char: 'n',
      description: 'Runs the push command without deleting local files.',
      env: 'SHOPIFY_FLAG_NODELETE',
    }),
    only: Flags.string({
      char: 'o',
      description: 'Download only the specified files (Multiple flags allowed).',
      multiple: true,
      env: 'SHOPIFY_FLAG_ONLY',
    }),
    ignore: Flags.string({
      char: 'x',
      description: 'Skip downloading the specified files (Multiple flags allowed).',
      multiple: true,
      env: 'SHOPIFY_FLAG_IGNORE',
    }),
    json: Flags.boolean({
      char: 'j',
      description: 'Output JSON instead of a UI.',
      env: 'SHOPIFY_FLAG_JSON',
    }),
    'allow-live': Flags.boolean({
      char: 'a',
      description: 'Allow push to a live theme.',
      env: 'SHOPIFY_FLAG_ALLOW_LIVE',
    }),
    publish: Flags.boolean({
      char: 'p',
      description: 'Publish as the live theme after uploading.',
      env: 'SHOPIFY_FLAG_PUBLISH',
    }),
    stable: Flags.boolean({
      hidden: true,
      description:
        'Performs the upload by relying in the legacy upload approach (slower, but it might be more stable in some scenarios)',
      env: 'SHOPIFY_FLAG_STABLE',
    }),
    force: Flags.boolean({
      hidden: true,
      char: 'f',
      description: 'Proceed without confirmation, if current directory does not seem to be theme directory.',
      env: 'SHOPIFY_FLAG_FORCE',
    }),
  }

  static cli2Flags = [
    'theme',
    'development',
    'live',
    'unpublished',
    'nodelete',
    'only',
    'ignore',
    'json',
    'allow-live',
    'publish',
    'force',
    'development-theme-id',
  ]

  async run(): Promise<void> {
    const {flags} = await this.parse(Push)
    const store = ensureThemeStore(flags)
    const adminSession = await ensureAuthenticatedThemes(store, flags.password)

    const developmentThemeManager = new DevelopmentThemeManager(adminSession)

    if (!flags.stable) {
      const {live, development, unpublished, path} = flags

      if (unpublished) {
        const themeName = flags.theme || (await promptThemeName(path))
        await developmentThemeManager.create(UNPUBLISHED_THEME_ROLE, themeName)
      }

      const theme = await findOrSelectTheme(adminSession, {
        header: 'Select a theme to open',
        filter: {
          live,
          unpublished,
          development,
          theme: flags.theme,
        },
      })

      if (theme.role === 'live' && !flags['allow-live']) {
        if (!(await confirmPushToLiveTheme(adminSession.storeFqdn))) {
          return
        }
      }

      await push(theme, adminSession, {path, nodelete: flags.nodelete})

      if (flags.publish) {
        await publishTheme(theme.id, adminSession)
      }

      return
    }

    showEmbeddedCLIWarning()

    const targetTheme = await (flags.development
      ? developmentThemeManager.findOrCreate()
      : developmentThemeManager.fetch())

    if (targetTheme) {
      if (flags.development) {
        flags.theme = `${targetTheme.id}`
        flags.development = false
      }
      if (useEmbeddedThemeCLI()) {
        flags['development-theme-id'] = targetTheme.id
      }
    }

    const flagsToPass = this.passThroughFlags(flags, {allowedFlags: Push.cli2Flags})
    const command = ['theme', 'push', flags.path, ...flagsToPass]

    await execCLI2(command, {store, adminToken: adminSession.token})
  }
}

async function promptThemeName(path: string) {
  const defaultName = await generateRandomNameForSubdirectory({
    suffix: 'theme',
    directory: path,
    family: 'creative',
  })
  return renderTextPrompt({message: 'Name of the new theme', defaultValue: defaultName})
}

async function confirmPushToLiveTheme(store: string) {
  const message = `Push theme files to the published theme on ${store}?`

  const options: RenderConfirmationPromptOptions = {
    message,
    confirmationMessage: 'Yes, confirm changes',
    cancellationMessage: 'Cancel',
  }

  return renderConfirmationPrompt(options)
}
