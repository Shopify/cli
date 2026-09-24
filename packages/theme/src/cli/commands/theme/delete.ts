import {themeDeleteJsonOutputSchema} from '../../services/delete/types.js'
import {renderThemeDeleteResult} from '../../services/delete/result.js'
import {themesDelete} from '../../services/delete.js'
import {themeFlags} from '../../flags.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {Flags} from '@oclif/core'
import {globalFlags, jsonFlag, requiredIfNonInteractive} from '@shopify/cli-kit/node/cli'
import {OutputFlags} from '@oclif/core/interfaces'
import {AdminSession} from '@shopify/cli-kit/node/session'
import type {NonTTYFlagRequirement} from '@shopify/cli-kit/node/base-command'

type DeleteFlags = OutputFlags<typeof Delete.flags>
export default class Delete extends ThemeCommand {
  static get jsonOutputSchema() {
    return themeDeleteJsonOutputSchema
  }

  static summary = "Delete remote themes from the connected store. This command can't be undone."

  static descriptionWithMarkdown = `Deletes a theme from your store.

  You can specify multiple themes by ID. If no theme is specified, then you're prompted to select the theme that you want to delete from the list of themes in your store.

  You're asked to confirm that you want to delete the specified themes before they are deleted. You can skip this confirmation using the \`--force\` flag.`

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    ...themeFlags,
    development: Flags.boolean({
      char: 'd',
      description:
        'Delete your development theme. Use --show-all, --development, or --theme in non-interactive environments.',
      env: 'SHOPIFY_FLAG_DEVELOPMENT',
    }),
    'show-all': Flags.boolean({
      char: 'a',
      description:
        'Include other development themes in the theme list. Use --show-all, --development, or --theme in non-interactive environments.',
      env: 'SHOPIFY_FLAG_SHOW_ALL',
    }),
    force: requiredIfNonInteractive(
      Flags.boolean({
        char: 'f',
        description: 'Skip confirmation.',
        env: 'SHOPIFY_FLAG_FORCE',
      }),
    ),
    theme: Flags.string({
      char: 't',
      description:
        'Theme ID or name of the remote theme. Use --show-all, --development, or --theme in non-interactive environments.',
      env: 'SHOPIFY_FLAG_THEME_ID',
      multiple: true,
    }),
  }

  static multiEnvironmentsFlags = ['store', 'password', ['development', 'theme', 'show-all']]

  static nonTTYFlagRequirements(): NonTTYFlagRequirement[] {
    return [{flags: ['theme', 'development', 'show-all']}]
  }

  async command(flags: DeleteFlags, adminSession: AdminSession, multiEnvironment: boolean) {
    const {environment, development, force, theme} = flags
    const themes = theme ?? []

    const result = await themesDelete(
      adminSession,
      {
        selectTheme: flags['show-all'],
        development,
        themes,
        force,
      },
      multiEnvironment,
    )
    if (!result) return
    if (flags.json && multiEnvironment) return result
    renderThemeDeleteResult(result, flags.json ? 'json' : 'text', {store: adminSession.storeFqdn, environment})
  }

  protected collectsEnvironmentResults(flags: {json?: boolean}): boolean {
    return Boolean(flags.json)
  }

  protected renderEnvironmentResults(environments: {environment: string; result: unknown}[]): void {
    outputResult(themeDeleteJsonOutputSchema.encode(themeDeleteJsonOutputSchema.validate({environments})))
  }
}
