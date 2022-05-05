import {appFlags} from '../../../flags'
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
    ...appFlags,
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
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'clone-url': Flags.string({
      hidden: true,
      char: 'u',
      description:
        'The Git URL to clone the function extensions templates from. Defaults to: https://github.com/Shopify/scripts-apis-examples',
      env: 'SHOPIFY_FLAG_CLONE_URL',
    }),
    language: Flags.string({
      hidden: true,
      char: 'l',
      options: ['wasm', 'rust', 'typescript'],
      description: 'Language of the template',
      env: 'SHOPIFY_FLAG_LANGUAGE',
    }),
  }

  static args = [{name: 'file'}]

  limited = {
    ui: ['product_subscription'],
    theme: ['theme'],
    function: [],
  }

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

  validateType(app: App, type: string | undefined) {
    if (this.extensionsLimitedByQuantity(app).includes(type)) {
      throw new error.Abort('Invalid extension type', `You can only scaffold one extension of type ${type} per app`)
    }
  }

  /**
   * Extensions of type `theme` and `product_subscription` are limited to one per app
   *
   * @param app {App} current App
   * @returns {string[]} list of extensions that are limited by quantity and are already scaffolded
   */
  limitedExtensionsAlreadyScaffolded(app: App): string[] {
    const themeTypes: string[] = app.extensions.theme.map((ext) => ext.configuration.type)
    const uiTypes: string[] = app.extensions.ui.map((ext) => ext.configuration.type)

    const themeExtensions = themeTypes.filter((type) => this.limited.theme.includes(type))
    const uiExtensions = uiTypes.filter((type) => this.limited.ui.includes(type))
    return [...themeExtensions, ...uiExtensions]

    // const hasThemeExtension = app.extensions.theme.filter((ext) => this.limited.theme.includes(ext.configuration.type))

    // const hasProductSubscription = app.extensions.ui.find((ext) => ext.configuration.type === 'product_subscription')
    // return [...(hasThemeExtension ? ['theme'] : []), ...(hasProductSubscription ? ['product_subscription'] : [])]
  }
}
