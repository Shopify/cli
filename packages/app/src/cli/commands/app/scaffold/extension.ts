import {output, path, cli, error} from '@shopify/cli-kit'
import {Command, Flags} from '@oclif/core'
import {extensions} from '$cli/constants'
import scaffoldExtensionPrompt from '$cli/prompts/scaffold/extension'
import {load as loadApp, App} from '$cli/models/app/app'
import scaffoldExtensionService from '$cli/services/scaffold/extension'

export default class AppScaffoldExtension extends Command {
  static description = 'Scaffold an Extension'
  static examples = ['<%= config.bin %> <%= command.id %>']

  static flags = {
    ...cli.globalFlags,
    type: Flags.string({
      char: 't',
      hidden: false,
      description: 'Extension type',
      options: extensions.types,
      env: 'SHOPIFY_FLAG_EXTENSION_TYPE',
    }),
    name: Flags.string({
      char: 'n',
      hidden: false,
      description: 'name of your Extension',
      env: 'SHOPIFY_FLAG_NAME',
    }),
    path: Flags.string({
      char: 'p',
      hidden: true,
      description: 'the path to your app directory',
      env: 'SHOPIFY_FLAG_PATH',
    }),
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'clone-url': Flags.string({
      hidden: true,
      char: 'u',
      description:
        'The Git URL to clone the function extensions templates from. Defaults to: https://github.com/Shopify/scripts-apis-examples',
      env: 'SHOPIFY_FLAG_CLONE_URL',
      default: 'https://github.com/Shopify/scripts-apis-examples',
    }),
    language: Flags.string({
      hidden: true,
      char: 'l',
      options: ['wasm', 'rust', 'typescript'],
      description: 'Language of the template',
      env: 'SHOPIFY_FLAG_LANGUAGE',
      default: 'wasm',
    }),
  }

  static args = [{name: 'file'}]

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(AppScaffoldExtension)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()
    const app: App = await loadApp(directory)
    this.validateType(app, flags.type)

    const promptAnswers = await scaffoldExtensionPrompt({
      extensionType: flags.type,
      ignoreExtensions: this.extensionsLimitedByQuantity(app),
      name: flags.name,
    })
    const {extensionType, name} = promptAnswers
    await scaffoldExtensionService({
      ...promptAnswers,
      app,
      cloneUrl: flags['clone-url'],
      language: flags.language,
    })
    output.info(output.content`Extension ${name} generated successfully!`)
  }

  validateType(app: App, type: string) {
    if (this.extensionsLimitedByQuantity(app).includes(type)) {
      throw new error.Abort('Invalid extension type', `You can only scaffold one extension of type ${type} per app`)
    }
  }

  extensionsLimitedByQuantity(app: App) {
    const hasThemeExtension = app.extensions.theme.length > 0
    const hasProductSubscription = app.extensions.ui.find((ext) => ext.configuration.type === 'product_subscription')
    return [...(hasThemeExtension ? ['theme'] : []), ...(hasProductSubscription ? ['product_subscription'] : [])]
  }
}
