import {appFlags} from '../../../flags.js'
import metadata from '../../../metadata.js'
import Command from '../../../utilities/app-command.js'
import generate from '../../../services/generate.js'
import {showApiKeyDeprecationWarning} from '../../../prompts/deprecation-warnings.js'
import {checkFolderIsValidApp} from '../../../models/app/loader.js'
import {Args, Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {renderWarning} from '@shopify/cli-kit/node/ui'

export default class AppGenerateExtension extends Command {
  static summary = 'Generate a new app Extension.'
  static examples = ['<%= config.bin %> <%= command.id %>']

  static descriptionWithMarkdown = `Generates a new [app extension](https://shopify.dev/docs/apps/app-extensions). For a list of app extensions that you can generate using this command, refer to [Supported extensions](https://shopify.dev/docs/apps/tools/cli/commands#supported-extensions).

  Each new app extension is created in a folder under \`extensions/\`. To learn more about the extensions file structure, refer to [App structure](https://shopify.dev/docs/apps/tools/cli/structure) and the documentation for your extension.
  `

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
    type: Flags.string({
      char: 't',
      hidden: false,
      description: `Deprecated. Please use --template`,
      env: 'SHOPIFY_FLAG_EXTENSION_TYPE',
    }),
    template: Flags.string({
      char: 't',
      hidden: false,
      description: `Extension template`,
      env: 'SHOPIFY_FLAG_EXTENSION_TEMPLATE',
    }),
    name: Flags.string({
      char: 'n',
      hidden: false,
      description: 'name of your Extension',
      env: 'SHOPIFY_FLAG_NAME',
    }),
    'clone-url': Flags.string({
      hidden: true,
      char: 'u',
      description:
        'The Git URL to clone the function extensions templates from. Defaults to: https://github.com/Shopify/function-examples',
      env: 'SHOPIFY_FLAG_CLONE_URL',
    }),
    flavor: Flags.string({
      hidden: false,
      description: 'Choose a starting template for your extension, where applicable',
      options: ['vanilla-js', 'react', 'typescript', 'typescript-react', 'wasm', 'rust'],
      env: 'SHOPIFY_FLAG_FLAVOR',
    }),
    reset: Flags.boolean({
      hidden: false,
      description: 'Reset all your settings.',
      env: 'SHOPIFY_FLAG_RESET',
      default: false,
      exclusive: ['config'],
    }),
    'api-key': Flags.string({
      hidden: true,
      description: 'The API key of your app.',
      env: 'SHOPIFY_FLAG_APP_API_KEY',
      exclusive: ['config'],
    }),
    'client-id': Flags.string({
      hidden: false,
      description: 'The Client ID of your app.',
      env: 'SHOPIFY_FLAG_CLIENT_ID',
      exclusive: ['config'],
    }),
  }

  static args = {
    file: Args.string(),
  }

  public static analyticsNameOverride(): string | undefined {
    return 'app scaffold extension'
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(AppGenerateExtension)
    if (flags['api-key']) {
      await showApiKeyDeprecationWarning()
    }
    const apiKey = flags['client-id'] || flags['api-key']

    await metadata.addPublicMetadata(() => ({
      cmd_scaffold_required_auth: true,
      cmd_scaffold_template_custom: flags['clone-url'] !== undefined,
      cmd_scaffold_type_owner: '@shopify/app',
    }))

    if (flags.type) {
      renderWarning({
        headline: ['The flag --type has been deprecated in favor of --template.'],
        body: ['Please use --template instead.'],
      })
      return
    }

    await checkFolderIsValidApp(flags.path)

    await generate({
      directory: flags.path,
      reset: flags.reset,
      apiKey,
      name: flags.name,
      cloneUrl: flags['clone-url'],
      template: flags.template,
      flavor: flags.flavor,
    })
  }
}
