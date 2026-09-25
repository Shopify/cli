import {themeRenameJsonOutputSchema} from '../../services/rename/types.js'
import {renderThemeRenameResult} from '../../services/rename/result.js'
import ThemeCommand, {RequiredFlags} from '../../utilities/theme-command.js'
import {themeFlags} from '../../flags.js'
import {renameTheme} from '../../services/rename.js'
import {OutputFlags} from '@oclif/core/interfaces'
import {outputResult} from '@shopify/cli-kit/node/output'
import {Flags} from '@oclif/core'
import {globalFlags, jsonFlag, requiredIfNonInteractive} from '@shopify/cli-kit/node/cli'
import {AdminSession} from '@shopify/cli-kit/node/session'
import type {NonTTYFlagRequirement} from '@shopify/cli-kit/node/base-command'

export default class Rename extends ThemeCommand {
  static get jsonOutputSchema() {
    return themeRenameJsonOutputSchema
  }

  static summary = 'Renames an existing theme.'

  static descriptionWithMarkdown = `Renames a theme in your store.

  If no theme is specified, then you're prompted to select the theme that you want to rename from the list of themes in your store.
  `

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    ...themeFlags,
    name: requiredIfNonInteractive(
      Flags.string({
        char: 'n',
        description: 'The new name for the theme.',
        env: 'SHOPIFY_FLAG_NEW_NAME',
        required: false,
      }),
    ),
    development: Flags.boolean({
      char: 'd',
      description:
        'Rename your development theme. Use --development, --live, or --theme in non-interactive environments.',
      env: 'SHOPIFY_FLAG_DEVELOPMENT',
    }),
    theme: Flags.string({
      char: 't',
      description:
        'Theme ID or name of the remote theme. Use --development, --live, or --theme in non-interactive environments.',
      env: 'SHOPIFY_FLAG_THEME_ID',
    }),
    live: Flags.boolean({
      char: 'l',
      description:
        'Rename your remote live theme. Use --development, --live, or --theme in non-interactive environments.',
      env: 'SHOPIFY_FLAG_LIVE',
    }),
  }

  static multiEnvironmentsFlags: RequiredFlags = ['store', 'password', 'name', ['live', 'development', 'theme']]

  static nonTTYFlagRequirements(): NonTTYFlagRequirement[] {
    return [{flags: ['theme', 'development', 'live']}]
  }

  async command(flags: OutputFlags<typeof Rename.flags>, adminSession: AdminSession, multiEnvironment = false) {
    const result = await renameTheme(flags, adminSession)
    if (flags.json && multiEnvironment) return result.data
    renderThemeRenameResult(result, flags.json ? 'json' : 'text', flags.environment)
  }

  protected collectsEnvironmentResults(flags: {json?: boolean}): boolean {
    return Boolean(flags.json)
  }

  protected renderEnvironmentResults(environments: {environment: string; result: unknown}[]): void {
    outputResult(themeRenameJsonOutputSchema.encode(themeRenameJsonOutputSchema.validate({environments})))
  }
}
