import {appFlags} from '../../../flags.js'
import {
  extensions,
  ExtensionTypes,
  getExtensionOutputConfig,
  limitedExtensions,
  isUiExtensionType,
  isThemeExtensionType,
  isFunctionExtensionType,
  functionExtensionTemplates,
  ExternalExtensionTypes,
  extensionTypeCategory,
  extensionTypeIsGated,
} from '../../../constants.js'
import generateExtensionPrompt from '../../../prompts/generate/extension.js'
import {AppInterface} from '../../../models/app/app.js'
import {load as loadApp} from '../../../models/app/loader.js'
import generateExtensionService, {ExtensionFlavor} from '../../../services/generate/extension.js'
import {getUIExtensionTemplates} from '../../../utilities/extensions/template-configuration.js'
import {
  mapExternalExtensionTypeToExtensionType,
  mapExtensionTypesToExternalExtensionTypes,
  mapExtensionTypeToExternalExtensionType,
} from '../../../utilities/extensions/name-mapper.js'
import metadata from '../../../metadata.js'
import Command from '../../../utilities/app-command.js'
import {output, path, cli, error, environment} from '@shopify/cli-kit'
import {Flags} from '@oclif/core'
import {PackageManager} from '@shopify/cli-kit/node/node-package-manager'

export default class AppScaffoldExtension extends Command {
  static description = 'Scaffold an Extension'
  static examples = ['<%= config.bin %> <%= command.id %>']

  static flags = {
    ...cli.globalFlags,
    ...appFlags,
    type: Flags.string({
      char: 't',
      hidden: false,
      description: `Extension type\n<options: ${mapExtensionTypesToExternalExtensionTypes(extensions.publicTypes).join(
        '|',
      )}>`,
      env: 'SHOPIFY_FLAG_EXTENSION_TYPE',
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
    template: Flags.string({
      hidden: false,
      description: 'Choose a starting template for your extension, where applicable',
      options: ['vanilla-js', 'react', 'typescript', 'typescript-react', 'wasm', 'rust'],
      env: 'SHOPIFY_FLAG_TEMPLATE',
    }),
  }

  static args = [{name: 'file'}]

  public static analyticsNameOverride(): string | undefined {
    return 'app scaffold extension'
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(AppScaffoldExtension)

    await metadata.addPublic(() => ({
      cmd_scaffold_required_auth: false,
      cmd_scaffold_template_custom: flags['clone-url'] !== undefined,
      cmd_scaffold_type_owner: '@shopify/app',
    }))

    const directory = flags.path ? path.resolve(flags.path) : process.cwd()
    const app: AppInterface = await loadApp(directory)

    flags.type = mapExternalExtensionTypeToExtensionType(flags.type as ExternalExtensionTypes)

    await this.validateExtensionType(flags.type)
    this.validateExtensionTypeLimit(app, flags.type)
    this.validateExtensionFlavor(flags.type, flags.template)

    const promptAnswers = await generateExtensionPrompt({
      extensionType: flags.type,
      extensionTypesAlreadyAtQuota: this.limitedExtensionsAlreadyScaffolded(app),
      name: flags.name,
      extensionFlavor: flags.template,
      directory: path.join(directory, 'extensions'),
    })

    const {extensionType, extensionFlavor} = promptAnswers
    await metadata.addPublic(() => ({
      cmd_scaffold_template_flavor: extensionFlavor,
      cmd_scaffold_type: extensionType,
      cmd_scaffold_type_category: extensionTypeCategory(extensionType),
      cmd_scaffold_type_gated: extensionTypeIsGated(extensionType),
      cmd_scaffold_used_prompts_for_type: extensionType !== flags.type,
    }))

    const extensionDirectory = await generateExtensionService({
      ...promptAnswers,
      extensionFlavor: extensionFlavor as ExtensionFlavor,
      extensionType,
      app,
      cloneUrl: flags['clone-url'],
    })

    const formattedSuccessfulMessage = this.formatSuccessfulRunMessage(
      promptAnswers.extensionType,
      path.relative(app.directory, extensionDirectory),
      app.packageManager,
    )
    output.info(formattedSuccessfulMessage)
  }

  async validateExtensionType(type: string | undefined) {
    if (!type) {
      return
    }
    const isShopify = await environment.local.isShopify()
    const supportedExtensions = isShopify ? extensions.types : extensions.publicTypes
    if (!supportedExtensions.includes(type)) {
      throw new error.Abort(
        `The following extension types are supported: ${mapExtensionTypesToExternalExtensionTypes(
          supportedExtensions,
        ).join(', ')}`,
      )
    }
  }

  /**
   * If the type passed as flag is not valid because it has already been scaffolded
   * and we don't allow multiple extensions of that type, throw an error
   * @param app - current App
   * @param type - extension type
   */
  validateExtensionTypeLimit(app: AppInterface, type: string | undefined) {
    if (type && this.limitedExtensionsAlreadyScaffolded(app).includes(type)) {
      throw new error.Abort(
        'Invalid extension type',
        `You can only scaffold one extension of type ${mapExtensionTypeToExternalExtensionType(type)} per app`,
      )
    }
  }

  validateExtensionFlavor(type: string | undefined, flavor: string | undefined) {
    if (!flavor || !type) {
      return
    }
    const uiExtensionTemplateNames = getUIExtensionTemplates(type).map((template) => template.value)
    const functionExtensionTemplateNames = functionExtensionTemplates.map((template) => template.value)

    const invalidTemplateError = (templates: string[]) => {
      // eslint-disable-next-line rulesdir/no-error-factory-functions
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
   * @param app - current App
   * @returns list of extensions that are limited by quantity and are already scaffolded
   */
  limitedExtensionsAlreadyScaffolded(app: AppInterface): string[] {
    const themeTypes = app.extensions.theme.map((ext) => ext.configuration.type)
    const uiTypes = app.extensions.ui.map((ext) => ext.configuration.type)

    const themeExtensions = themeTypes.filter((type) => limitedExtensions.theme.includes(type))
    const uiExtensions = uiTypes.filter((type) => limitedExtensions.ui.includes(type))
    return [...themeExtensions, ...uiExtensions]
  }

  formatSuccessfulRunMessage(
    extensionType: ExtensionTypes,
    extensionDirectory: string,
    depndencyManager: PackageManager,
  ): string {
    const extensionOutputConfig = getExtensionOutputConfig(extensionType)
    output.completed(`Your ${extensionOutputConfig.humanKey} extension was added to your project!`)

    const outputTokens = []
    outputTokens.push(
      output.content`\n  To find your extension, remember to ${output.token.genericShellCommand(
        output.content`cd ${output.token.path(extensionDirectory)}`,
      )}`.value,
    )

    if (isUiExtensionType(extensionType) || isThemeExtensionType(extensionType)) {
      outputTokens.push(
        output.content`  To preview your project, run ${output.token.packagejsonScript(depndencyManager, 'dev')}`.value,
      )
    }

    if (extensionOutputConfig.additionalHelp) {
      outputTokens.push(`  ${extensionOutputConfig.additionalHelp}`)
    }

    if (extensionOutputConfig.helpURL) {
      outputTokens.push(
        output.content`  For more details, see the ${output.token.link('docs', extensionOutputConfig.helpURL)} ✨`
          .value,
      )
    }

    return outputTokens.join('\n').concat('\n')
  }
}
