import ThemeCommand from '../../../utilities/theme-command.js'
import {themeFlags} from '../../../flags.js'
import {run} from '../../../services/update/run.js'
import {ensureThemeStore} from '../../../utilities/theme-store.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {Flags} from '@oclif/core'
export default class UpdateRun extends ThemeCommand {
  static description = `Run the theme update process.`
  static flags = {
    ...globalFlags,
    path: themeFlags.path,
    password: themeFlags.password,
    store: themeFlags.store,
    script: Flags.string({
      description: `The path to the 'update_extension.json' script.`,
      env: 'SHOPIFY_FLAG_SCRIPT',
    }),
    'from-theme': Flags.string({
      description: 'The theme ID or name of the theme at the previous version.',
      env: 'SHOPIFY_FLAG_SOURCE_THEME',
      required: true,
    }),
    'to-theme': Flags.string({
      description: 'The theme ID or name of the theme at the target version.',
      env: 'SHOPIFY_FLAG_TARGET_THEME',
      required: true,
    }),
  }
  async run(): Promise<void> {
    const {flags} = await this.parse(UpdateRun)
    const store = ensureThemeStore(flags)
    const adminSession = await ensureAuthenticatedThemes(store, flags.password)
    await run(adminSession, flags)
  }
}