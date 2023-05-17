import ThemeCommand from '../../../utilities/theme-command.js'
import {themeFlags} from '../../../flags.js'
import {run} from '../../../services/update/run.js'
import {ensureThemeStore} from '../../../utilities/theme-store.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {Flags} from '@oclif/core'
import {renderWarning} from '@shopify/cli-kit/node/ui'

export default class UpdateRun extends ThemeCommand {
  static description = `Run an 'update_extension.json' script in a theme.`

  static flags = {
    ...globalFlags,
    path: themeFlags.path,
    store: themeFlags.store,
    script: Flags.string({
      description: `The path to the 'update_extension.json' script.`,
      env: 'SHOPIFY_FLAG_SCRIPT',
      default: `./update_extension.json`,
    }),
    'source-theme': Flags.string({
      description: 'The theme ID or name of the theme at the previous version.',
      env: 'SHOPIFY_FLAG_SOURCE_THEME',
      required: true,
    }),
    'target-theme': Flags.string({
      description: 'The theme ID or name of the theme at the target version.',
      env: 'SHOPIFY_FLAG_TARGET_THEME',
      required: true,
    }),
  }

  async run(): Promise<void> {
    /**
     * FIXME: Remove this warning when `triggerUpdaterAPI` gets updated at
     * `packages/theme/src/cli/services/update/run.ts`.
     */
    renderWarning({
      body: [{bold: 'Upcoming feature:'}, 'This command is under development and may not function as expected.'],
    })

    const {flags} = await this.parse(UpdateRun)
    const store = ensureThemeStore(flags)
    const adminSession = await ensureAuthenticatedThemes(store, flags.password)

    await run(adminSession, flags)
  }
}
