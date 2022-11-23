import {appFlags} from '../../../flags.js'
import {
  extensions,
  ExtensionTypes,
  getExtensionOutputConfig,
  isUiExtensionType,
  isThemeExtensionType,
  isFunctionExtensionType,
  functionExtensionTemplates,
  extensionTypeCategory,
  extensionTypeIsGated,
} from '../../../constants.js'
import generateExtensionPrompt from '../../../prompts/generate/extension.js'
import {AppInterface} from '../../../models/app/app.js'
import {load as loadApp} from '../../../models/app/loader.js'
import generateExtensionService, {ExtensionFlavor} from '../../../services/generate/extension.js'
import {getUIExtensionTemplates} from '../../../utilities/extensions/template-configuration.js'
import {mapExtensionTypesToExternalExtensionTypes} from '../../../utilities/extensions/name-mapper.js'
import metadata from '../../../metadata.js'
import Command from '../../../utilities/app-command.js'
import {ensureGenerateEnvironment} from '../../../services/environment.js'
import {fetchExtensionSpecifications} from '../../../utilities/extensions/fetch-extension-specifications.js'
import {allFunctionSpecifications} from '../../../models/extensions/specifications.js'
import {FunctionSpec} from '../../../models/extensions/functions.js'
import {output, path, cli, error, environment, session} from '@shopify/cli-kit'
import {Flags} from '@oclif/core'
import {PackageManager} from '@shopify/cli-kit/node/node-package-manager'
import {RemoteSpecification} from '@shopify/cli-kit/src/api/graphql/extension_specifications.js'

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
    reset: Flags.boolean({
      hidden: false,
      description: 'Reset all your settings.',
      env: 'SHOPIFY_FLAG_RESET',
      default: false,
    }),
    'api-key': Flags.string({
      hidden: false,
      description: 'The API key of your app.',
      env: 'SHOPIFY_FLAG_APP_API_KEY',
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

    const isShopify = await environment.local.isShopify()
    const token = await session.ensureAuthenticatedPartners()
    const apiKey = await ensureGenerateEnvironment({apiKey: flags['api-key'], directory, reset: flags.reset, token})
    const extensionsSpecs = await fetchExtensionSpecifications(token, apiKey)
    const functionSpecs = await (await allFunctionSpecifications()).filter((spec) => spec.public || isShopify)
    let allExtensionSpecs = [...extensionsSpecs, ...functionSpecs]

    // Pending: use specs to load local extensions
    const app: AppInterface = await loadApp(directory)
    const specification = this.findSpecification(flags.type, extensionsSpecs, functionSpecs)
    const allExternalTypes = allExtensionSpecs.map((spec) => spec.externalIdentifier)

    if (flags.type && !specification) {
      throw new error.Abort(`The following extension types are supported: ${allExternalTypes.join(', ')}`)
    }

    // Map to always use the internal type from now on
    flags.type = specification?.identifier || flags.type

    if (specification) {
      const existing = app.extensionsForType(specification)
      const limit = specification.options.registrationLimit
      if (existing.length >= limit) {
        throw new error.Abort(
          'Invalid extension type',
          `You can only generate ${limit} extension(s) of type ${specification.externalIdentifier} per app`,
        )
      }
    } else {
      allExtensionSpecs = allExtensionSpecs.filter((spec) => {
        const existing = app.extensionsForType(spec)
        output.debug(`${existing.length}: ${spec.externalIdentifier}`)
        return existing.length < spec.options.registrationLimit
      })
    }

    this.validateExtensionFlavor(specification?.identifier, flags.template)

    const promptAnswers = await generateExtensionPrompt({
      extensionType: flags.type,
      name: flags.name,
      extensionFlavor: flags.template,
      directory: path.join(directory, 'extensions'),
      app,
      extensionSpecifications: allExtensionSpecs,
      reset: flags.reset,
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

  findSpecification(type: string | undefined, extensionSpecs: RemoteSpecification[], functionSpecs: FunctionSpec[]) {
    if (!type) return
    // Harcode some types that are not present in the remote specs with the same words
    if (type === 'theme') return extensionSpecs.find((spec) => spec.identifier === 'theme_app_extension')
    if (type === 'product_subscription')
      return extensionSpecs.find((spec) => spec.identifier === 'subscription_management')
    const extensionSpec = extensionSpecs.find((spec) => spec.identifier === type || spec.externalIdentifier === type)
    const functionSpec = functionSpecs.find((spec) => spec.identifier === type || spec.externalIdentifier === type)
    return extensionSpec ?? functionSpec
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
