import {ensureThemeStore} from '../../utilities/theme-store.js'
import {themeFlags} from '../../flags.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {duplicate} from '../../services/duplicate.js'
import {Flags} from '@oclif/core'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'

export default class Duplicate extends ThemeCommand {
  static summary = 'Duplicates a theme from your theme library.'

  static usage = ['theme duplicate', "theme duplicate --theme 10 --name 'New Theme'"]

  static descriptionWithMarkdown = `If you want to duplicate your local theme, you need to run \`shopify theme push\` first.

If no theme ID is specified, you're prompted to select the theme that you want to duplicate from the list of themes in your store. You're asked to confirm that you want to duplicate the specified theme.

Prompts and confirmations are not shown when duplicate is run in a CI environment or the \`--force\` flag is used, therefore you must specify a theme ID using the \`--theme\` flag.

You can optionally name the duplicated theme using the \`--name\` flag.

If you use the \`--json\` flag, then theme information is returned in JSON format, which can be used as a machine-readable input for scripts or continuous integration.

Sample JSON output:

\`\`\`json
{
  "theme": {
    "id": 108267175958,
    "name": "A Duplicated Theme",
    "role": "unpublished",
    "shop": "mystore.myshopify.com"
  }
}
\`\`\`

\`\`\`json
{
  "message": "The theme 'Summer Edition' could not be duplicated due to errors",
  "errors": ["Maximum number of themes reached"],
  "requestId": "12345-abcde-67890"
}
\`\`\``

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    password: themeFlags.password,
    theme: Flags.string({
      char: 't',
      description: 'Theme ID or name of the remote theme.',
      env: 'SHOPIFY_FLAG_THEME_ID',
    }),
    name: Flags.string({
      char: 'n',
      description: 'Name of the newly duplicated theme.',
      env: 'SHOPIFY_FLAG_NAME',
    }),
    store: themeFlags.store,
    environment: themeFlags.environment,
    force: Flags.boolean({
      char: 'f',
      description: 'Force the duplicate operation to run without prompts or confirmations.',
      env: 'SHOPIFY_FLAG_FORCE',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Duplicate)
    const store = ensureThemeStore(flags)
    const adminSession = await ensureAuthenticatedThemes(store, flags.password)

    await duplicate(adminSession, flags.theme, flags)
  }
}
