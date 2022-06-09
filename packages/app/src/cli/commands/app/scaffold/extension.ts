import {appFlags} from '../../../flags'
import {
  extensions,
  ExtensionTypes,
  ExtensionOutputConfig,
  getExtensionOutputConfig,
  limitedExtensions,
  isUiExtensionType,
  isFunctionExtensionType,
  functionExtensionTemplates,
  uiExtensionTemplates,
} from '../../../constants'
import scaffoldExtensionPrompt from '../../../prompts/scaffold/extension'
import {load as loadApp, App} from '../../../models/app/app'
import scaffoldExtensionService from '../../../services/scaffold/extension'
import {output, path, cli, error, environment} from '@shopify/cli-kit'
import {Command, Flags} from '@oclif/core'

export default class AppScaffoldExtension extends Command {
  static description = 'Scaffold an Extension'
  static examples = ['<%= config.bin %> <%= command.id %>']

  static flags = {
    ...cli.globalFlags,
    ...appFlags,
    type: Flags.string({
      char: 't',
      hidden: false,
      description: `Extension type\n<options: ${extensions.publicTypes.join('|')}>`,
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
    template: Flags.string({
      hidden: false,
      description: 'Choose a starting template for your extension, where applicable',
      options: ['vanilla-js', 'react', 'wasm', 'rust'],
      env: 'SHOPIFY_FLAG_TEMPLATE',
    }),
  }

  static args = [{name: 'file'}]

  public async run(): Promise<void> {
    const {flags} = await this.parse(AppScaffoldExtension)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()
    const app: App = await loadApp(directory)

    await this.validateExtensionType(flags.type)
    this.validateExtensionTypeLimit(app, flags.type)
    const extensionFlavor = flags.template
    this.validateExtensionFlavor(flags.type, extensionFlavor)

    const promptAnswers = await scaffoldExtensionPrompt({
      extensionType: flags.type,
      extensionTypesAlreadyAtQuota: this.limitedExtensionsAlreadyScaffolded(app),
      name: flags.name,
      extensionFlavor,
    })

    const extensionDirectory = await scaffoldExtensionService({
      ...promptAnswers,
      extensionType: promptAnswers.extensionType,
      app,
      cloneUrl: flags['clone-url'],
    })

    const extensionOutputConfig = getExtensionOutputConfig(promptAnswers.extensionType)
    output.success(
      output.content`Your ${
        extensionOutputConfig.humanKey
      } extension was added to your project, and can be found in ${output.token.path(
        path.relative(app.directory, extensionDirectory),
      )}`,
    )
    output.info(this.formatSuccessfulRunMessage(promptAnswers.extensionType, extensionOutputConfig))
  }

  async validateExtensionType(type: string | undefined) {
    if (!type) {
      return
    }
    const isShopify = await environment.local.isShopify()
    const supportedExtensions = isShopify ? extensions.types : extensions.publicTypes
    if (!(extensions.types as string[]).includes(type)) {
      throw new error.Abort(
        `Invalid extension type ${type}`,
        `The following extension types are supported: ${supportedExtensions.join(', ')}`,
      )
    }
  }

  /**
   * If the type passed as flag is not valid because it has already been scaffolded
   * and we don't allow multiple extensions of that type, throw an error
   * @param app {App} current App
   * @param type {string} extension type
   */
  validateExtensionTypeLimit(app: App, type: string | undefined) {
    if (type && this.limitedExtensionsAlreadyScaffolded(app).includes(type)) {
      throw new error.Abort('Invalid extension type', `You can only scaffold one extension of type ${type} per app`)
    }
  }

  validateExtensionFlavor(type: string | undefined, flavor: string | undefined) {
    if (!flavor || !type) {
      return
    }
    const uiExtensionTemplateNames = uiExtensionTemplates.map((template) => template.value)
    const functionExtensionTemplateNames = functionExtensionTemplates.map((template) => template.value)

    const invalidTemplateError = (templates: string[]) => {
      return new error.Abort(
        'Specified extension template on invalid extension type',
        `You can only specify a template for these extension types: ${templates.join(', ')}.`,
      )
    }
    if (isUiExtensionType(type) && !uiExtensionTemplateNames.includes(flavor)) {
      throw invalidTemplateError(uiExtensionTemplateNames)
    }
    if (isFunctionExtensionType(type) && !functionExtensionTemplateNames.includes(flavor)) {
      throw invalidTemplateError(functionExtensionTemplateNames)
    }
  }

  /**
   * Some extension types like `theme` and `product_subscription` are limited to one per app
   * Use this method to retrieve a list of the limited types that have already been scaffolded
   *
   * @param app {App} current App
   * @returns {string[]} list of extensions that are limited by quantity and are already scaffolded
   */
  limitedExtensionsAlreadyScaffolded(app: App): string[] {
    const themeTypes = app.extensions.theme.map((ext) => ext.configuration.type)
    const uiTypes = app.extensions.ui.map((ext) => ext.configuration.type)

    const themeExtensions = themeTypes.filter((type) => limitedExtensions.theme.includes(type))
    const uiExtensions = uiTypes.filter((type) => limitedExtensions.ui.includes(type))
    return [...themeExtensions, ...uiExtensions]
  }

  formatSuccessfulRunMessage(extensionType: ExtensionTypes, extensionOutputConfig: ExtensionOutputConfig): string {
    const outputTokens = []
    if (extensionOutputConfig.additionalHelp) {
      outputTokens.push(extensionOutputConfig.additionalHelp)
    }
    if (extensionOutputConfig.helpURL) {
      outputTokens.push(
        output.content`For help, see ${output.token.link('docs', extensionOutputConfig.helpURL)}.`.value,
      )
    }

    return outputTokens.join('\n')
  }
}
