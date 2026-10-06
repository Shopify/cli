import {themeDuplicateJsonOutputSchema} from '../../services/duplicate/types.js'
import {renderThemeDuplicateResult, themeDuplicateJsonResult} from '../../services/duplicate/result.js'
import {configureCLIEnvironment} from '../../utilities/cli-config.js'
import {themeFlags} from '../../flags.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {duplicate} from '../../services/duplicate.js'
import {Flags} from '@oclif/core'
import {globalFlags, jsonFlag, requiredIfNonInteractive} from '@shopify/cli-kit/node/cli'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {isCI} from '@shopify/cli-kit/node/system'
import type {OutputFlags} from '@oclif/core/interfaces'
import type {NonTTYFlagRequirement} from '@shopify/cli-kit/node/base-command'

export default class Duplicate extends ThemeCommand {
  static get jsonOutputSchema() {
    return themeDuplicateJsonOutputSchema
  }

  static summary = 'Duplicates a theme from your theme library.'

  static usage = ['theme duplicate', "theme duplicate --theme 10 --name 'New Theme'"]

  static descriptionWithMarkdown = `If you want to duplicate your local theme, you need to run \`shopify theme push\` first.

If no theme ID is specified, you're prompted to select the theme that you want to duplicate from the list of themes in your store. You're asked to confirm that you want to duplicate the specified theme.

Prompts and confirmations are not shown when duplicate is run in a CI environment or the \`--force\` flag is used, therefore you must specify a theme ID using the \`--theme\` flag.

You can optionally name the duplicated theme using the \`--name\` flag.

If you use the \`--json\` flag, then theme information is returned in JSON format, which can be used as a machine-readable input for scripts or continuous integration.

Successful JSON results include \`status\`, \`changed\`, and explicit \`originalTheme\` and \`theme\` resources with decimal string IDs. Failures use the shared \`{error}\` document.`

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    password: themeFlags.password,
    theme: requiredIfNonInteractive(
      Flags.string({
        char: 't',
        description: 'Theme ID or name of the remote theme.',
        env: 'SHOPIFY_FLAG_THEME_ID',
      }),
    ),
    name: Flags.string({
      char: 'n',
      description: 'Name of the newly duplicated theme.',
      env: 'SHOPIFY_FLAG_NAME',
    }),
    store: themeFlags.store,
    environment: themeFlags.environment,
    force: Flags.boolean({
      char: 'f',
      description:
        'Force the duplicate operation to run without prompts or confirmations. Required if non interactive outside CI.',
      env: 'SHOPIFY_FLAG_FORCE',
    }),
  }

  static multiEnvironmentsFlags = ['store', 'password', 'theme']

  static nonTTYFlagRequirements(): NonTTYFlagRequirement[] {
    return [{flags: ['force'], when: () => !isCI()}]
  }

  async command(flags: OutputFlags<typeof Duplicate.flags>, adminSession: AdminSession, multiEnvironment = false) {
    configureCLIEnvironment(flags)
    const result = await duplicate(adminSession, flags.theme, flags)
    if (flags.json && multiEnvironment) return themeDuplicateJsonResult(result)
    renderThemeDuplicateResult(result, flags.json ? 'json' : 'text')
  }
}
