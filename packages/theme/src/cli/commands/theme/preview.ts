import {themeFlags} from '../../flags.js'
import ThemeCommand, {RequiredFlags} from '../../utilities/theme-command.js'
import {devWithOverrideFile} from '../../services/dev-override.js'
import {renderThemePreviewResult, renderThemePreviewOpenError} from '../../services/dev-override/result.js'
import {themePreviewJsonOutputSchema} from '../../services/dev-override/types.js'
import {findOrSelectTheme} from '../../utilities/theme-selector.js'
import {Flags} from '@oclif/core'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {openURL} from '@shopify/cli-kit/node/system'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {InferredFlags} from '@oclif/core/interfaces'
import {outputResult} from '@shopify/cli-kit/node/output'
import {AbortError} from '@shopify/cli-kit/node/error'
import type {ThemeEnvironmentResult} from '../../services/json-output/schema.js'

type PreviewFlags = InferredFlags<typeof Preview.flags>

export default class Preview extends ThemeCommand {
  static get jsonOutputSchema() {
    return themePreviewJsonOutputSchema
  }

  static summary = 'Applies JSON overrides to a theme and returns a preview URL.'

  static descriptionWithMarkdown = `Applies a JSON overrides file to a theme and creates or updates a preview. This lets you quickly preview changes.

  The command returns a preview URL and a preview identifier. You can reuse the preview identifier with \`--preview-id\` to update an existing preview instead of creating a new one.`

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    ...themeFlags,
    theme: Flags.string({
      char: 't',
      description: 'Theme ID or name of the remote theme.',
      env: 'SHOPIFY_FLAG_THEME_ID',
    }),
    overrides: Flags.string({
      description: 'Path to a JSON overrides file.',
      env: 'SHOPIFY_FLAG_OVERRIDES',
    }),
    'preview-id': Flags.string({
      description: 'An existing preview identifier to update instead of creating a new preview.',
      env: 'SHOPIFY_FLAG_PREVIEW_ID',
    }),
    open: Flags.boolean({
      description: 'Automatically launch the theme preview in your default web browser.',
      env: 'SHOPIFY_FLAG_OPEN',
      default: false,
    }),
    json: Flags.boolean({
      ...jsonFlag.json,
      description: 'Output the preview URL and identifier as JSON.',
      env: 'SHOPIFY_FLAG_JSON',
      default: false,
    }),
  }

  static multiEnvironmentsFlags: RequiredFlags = null

  async command(flags: PreviewFlags, adminSession: AdminSession, multiEnvironment = false) {
    if (!flags.theme || !flags.overrides) {
      throw new AbortError('Specify both --theme and --overrides, either as flags or in an environment.')
    }
    const theme = await findOrSelectTheme(adminSession, {filter: {theme: flags.theme}})
    const result = await devWithOverrideFile({
      adminSession,
      overrideJson: flags.overrides,
      themeId: theme.id.toString(),
      previewIdentifier: flags['preview-id'],
      password: flags.password,
    })
    const format = flags.json ? 'json' : 'text'
    if (flags.open) {
      await openURL(result.url).catch((error: Error) => renderThemePreviewOpenError(error, format))
    }
    if (!multiEnvironment || !flags.json) renderThemePreviewResult(result, format, Boolean(flags['preview-id']))
    return result
  }

  protected collectsEnvironmentResults(flags: Partial<PreviewFlags>): boolean {
    return Boolean(flags.json)
  }

  protected renderEnvironmentResults(environments: ThemeEnvironmentResult[]): void {
    outputResult(themePreviewJsonOutputSchema.encode({environments}))
  }
}
