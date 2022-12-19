import {appFlags} from '../../../flags.js'
import generateExtensionPrompt from '../../../prompts/generate/extension.js'
import {AppInterface} from '../../../models/app/app.js'
import {load as loadApp} from '../../../models/app/loader.js'
import generateExtensionService, {ExtensionFlavor} from '../../../services/generate/extension.js'
import metadata from '../../../metadata.js'
import Command from '../../../utilities/app-command.js'
import {ensureGenerateEnvironment} from '../../../services/environment.js'
import {fetchSpecifications} from '../../../utilities/extensions/fetch-extension-specifications.js'
import {GenericSpecification} from '../../../models/app/extensions.js'
import {output, path, cli, error, session} from '@shopify/cli-kit'
import {Flags} from '@oclif/core'
import {PackageManager} from '@shopify/cli-kit/node/node-package-manager'

export default class AppGenerateExtension extends Command {
  static description = 'Scaffold an Extension'
  static examples = ['<%= config.bin %> <%= command.id %>']

  static flags = {
    ...cli.globalFlags,
    ...appFlags,
    type: Flags.string({
      char: 't',
      hidden: false,
      description: `Extension type`,
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
    const {flags} = await this.parse(AppGenerateExtension)

    await metadata.addPublic(() => ({
      cmd_scaffold_required_auth: true,
      cmd_scaffold_template_custom: flags['clone-url'] !== undefined,
      cmd_scaffold_type_owner: '@shopify/app',
    }))

    const directory = flags.path ? path.resolve(flags.path) : process.cwd()

    const token = await session.ensureAuthenticatedPartners()
    const apiKey = await ensureGenerateEnvironment({apiKey: flags['api-key'], directory, reset: flags.reset, token})
    let allExtensionSpecs = await fetchSpecifications(token, apiKey)
    const app: AppInterface = await loadApp(directory, allExtensionSpecs)
    const specification = this.findSpecification(flags.type, allExtensionSpecs)
    const allExternalTypes = allExtensionSpecs.map((spec) => spec.externalIdentifier)

    if (flags.type && !specification) {
      throw new error.Abort(`The following extension types are supported: ${allExternalTypes.join(', ')}`)
    }

    // Map to always use the internal type from now on
    flags.type = specification?.identifier || flags.type

    if (specification) {
      const existing = app.extensionsForType(specification)
      const limit = specification.registrationLimit
      if (existing.length >= limit) {
        throw new error.Abort(
          'Invalid extension type',
          `You can only generate ${limit} extension(s) of type ${specification.externalIdentifier} per app`,
        )
      }
    } else {
      // Filter out any extension types that have reached their limit
      allExtensionSpecs = allExtensionSpecs.filter((spec) => {
        const existing = app.extensionsForType(spec)
        output.debug(`${existing.length}: ${spec.externalIdentifier}`)
        return existing.length < spec.registrationLimit
      })
    }

    this.validateExtensionFlavor(specification, flags.template)

    const promptAnswers = await generateExtensionPrompt({
      extensionType: flags.type,
      name: flags.name,
      extensionFlavor: flags.template,
      directory: path.join(directory, 'extensions'),
      app,
      extensionSpecifications: allExtensionSpecs,
      reset: flags.reset,
    })

    const {extensionType, extensionFlavor, name} = promptAnswers
    const selectedSpecification = this.findSpecification(extensionType, allExtensionSpecs)
    if (!selectedSpecification)
      throw new error.Abort(`The following extension types are supported: ${allExternalTypes.join(', ')}`)

    await metadata.addPublic(() => ({
      cmd_scaffold_template_flavor: extensionFlavor,
      cmd_scaffold_type: extensionType,
      cmd_scaffold_type_category: selectedSpecification.category(),
      cmd_scaffold_type_gated: selectedSpecification.gated,
      cmd_scaffold_used_prompts_for_type: extensionType !== flags.type,
    }))

    const extensionDirectory = await generateExtensionService({
      name,
      extensionFlavor: extensionFlavor as ExtensionFlavor,
      specification: selectedSpecification,
      app,
      extensionType: selectedSpecification.identifier,
      cloneUrl: flags['clone-url'],
    })

    const formattedSuccessfulMessage = this.formatSuccessfulRunMessage(
      selectedSpecification,
      path.relative(app.directory, extensionDirectory),
      app.packageManager,
    )
    output.info(formattedSuccessfulMessage)
  }

  findSpecification(type: string | undefined, specifications: GenericSpecification[]) {
    return specifications.find((spec) => spec.identifier === type || spec.externalIdentifier === type)
  }

  validateExtensionFlavor(specification: GenericSpecification | undefined, flavor: string | undefined) {
    if (!flavor || !specification) return

    const possibleFlavors = specification.supportedFlavors.map((flavor) => flavor.name)
    if (possibleFlavors.includes(flavor)) {
      throw new error.Abort(
        'Specified extension template on invalid extension type',
        `You can only specify a template for these extension types: ${possibleFlavors.join(', ')}.`,
      )
    }
  }

  formatSuccessfulRunMessage(
    specification: GenericSpecification,
    extensionDirectory: string,
    depndencyManager: PackageManager,
  ): string {
    output.completed(`Your ${specification.externalName} extension was added to your project!`)

    const outputTokens = []
    outputTokens.push(
      output.content`\n  To find your extension, remember to ${output.token.genericShellCommand(
        output.content`cd ${output.token.path(extensionDirectory)}`,
      )}`.value,
    )

    if (specification.category() === 'ui' || specification.category() === 'theme') {
      outputTokens.push(
        output.content`  To preview your project, run ${output.token.packagejsonScript(depndencyManager, 'dev')}`.value,
      )
    }

    if (specification.helpURL) {
      outputTokens.push(
        output.content`  For more details, see the ${output.token.link('docs', specification.helpURL)} ✨`.value,
      )
    }

    return outputTokens.join('\n').concat('\n')
  }
}
