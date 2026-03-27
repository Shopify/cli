import {themeFlags} from '../../flags.js'
import ThemeCommand, {RequiredFlags} from '../../utilities/theme-command.js'
import {devWithOverrideFile} from '../../services/dev-override.js'
import {findOrSelectTheme} from '../../utilities/theme-selector.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {InferredFlags} from '@oclif/core/interfaces'

type PreviewFlags = InferredFlags<typeof Preview.flags>

export default class Preview extends ThemeCommand {
  static summary =
    'Applies JSON overrides to a theme and returns a preview URL.'

  static descriptionWithMarkdown = `Applies a JSON overrides file to a theme and creates or updates a preview. This lets you quickly preview changes.

  The command returns a preview URL and a preview identifier. You can reuse the preview identifier with \`--preview-id\` to update an existing preview instead of creating a new one.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...themeFlags,
    theme: Flags.string({
      char: 't',
      description: 'Theme ID or name of the remote theme.',
      env: 'SHOPIFY_FLAG_THEME_ID',
      required: true,
    }),
    overrides: Flags.string({
      description: 'Path to a JSON overrides file.',
      env: 'SHOPIFY_FLAG_OVERRIDES',
      required: true,
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
      description: 'Output the preview URL and identifier as JSON.',
      env: 'SHOPIFY_FLAG_JSON',
      default: false,
    }),
  }

  static multiEnvironmentsFlags: RequiredFlags = null

  async command(flags: PreviewFlags, adminSession: AdminSession) {
    const theme = await findOrSelectTheme(adminSession, {filter: {theme: flags.theme}})
    await devWithOverrideFile({
      adminSession,
      overrideJson: flags.overrides,
      themeId: theme.id.toString(),
      previewIdentifier: flags['preview-id'],
      open: flags.open,
      password: flags.password,
      json: flags.json,
    })
  }
}
