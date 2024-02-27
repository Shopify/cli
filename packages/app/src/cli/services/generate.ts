import {fetchExtensionTemplates} from './generate/fetch-template-specifications.js'
import {ensureGenerateContext} from './context.js'
import {selectDeveloperPlatformClient, DeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {AppInterface} from '../models/app/app.js'
import {loadApp} from '../models/app/loader.js'
import generateExtensionPrompts, {
  GenerateExtensionPromptOptions,
  GenerateExtensionPromptOutput,
} from '../prompts/generate/extension.js'
import metadata from '../metadata.js'
import {
  GenerateExtensionTemplateOptions,
  GeneratedExtension,
  generateExtensionTemplate,
  ExtensionFlavorValue,
} from '../services/generate/extension.js'
import {ExtensionTemplate, TemplateType} from '../models/app/template.js'
import {ExtensionSpecification} from '../models/extensions/specification.js'
import {PackageManager} from '@shopify/cli-kit/node/node-package-manager'
import {isShopify} from '@shopify/cli-kit/node/context/local'
import {joinPath} from '@shopify/cli-kit/node/path'
import {RenderAlertOptions, renderSuccess} from '@shopify/cli-kit/node/ui'
import {AbortError} from '@shopify/cli-kit/node/error'
import {formatPackageManagerCommand} from '@shopify/cli-kit/node/output'
import {groupBy} from '@shopify/cli-kit/common/collection'

export interface GenerateOptions {
  directory: string
  reset: boolean
  apiKey?: string
  template?: string
  flavor?: string
  name?: string
  cloneUrl?: string
  configName?: string
  developerPlatformClient?: DeveloperPlatformClient
}

async function generate(options: GenerateOptions) {
  const developerPlatformClient = options.developerPlatformClient ?? selectDeveloperPlatformClient()
  const partnersSession = await developerPlatformClient.session()
  const token = partnersSession.token
  const apiKey = await ensureGenerateContext({...options, developerPlatformClient, partnersSession})
  const specifications = await developerPlatformClient.specifications(apiKey)
  const app: AppInterface = await loadApp({
    directory: options.directory,
    configName: options.configName,
    specifications,
  })
  const availableSpecifications = specifications.map((spec) => spec.identifier)
  const extensionTemplates = await fetchExtensionTemplates(token, apiKey, availableSpecifications)

  const promptOptions = await buildPromptOptions(extensionTemplates, specifications, app, options)
  const promptAnswers = await generateExtensionPrompts(promptOptions)

  await saveAnalyticsMetadata(promptAnswers, options.template)

  const generateExtensionOptions = buildGenerateOptions(promptAnswers, app, options)
  const generatedExtensions = await generateExtensionTemplate(generateExtensionOptions)

  renderSuccessMessages(generatedExtensions, app.packageManager)
}

async function buildPromptOptions(
  extensionTemplates: ExtensionTemplate[],
  specifications: ExtensionSpecification[],
  app: AppInterface,
  options: GenerateOptions,
): Promise<GenerateExtensionPromptOptions> {
  const extensionTemplate = await handleTypeParameter(options.template, app, extensionTemplates, specifications)
  validateExtensionFlavor(extensionTemplate, options.flavor)

  const {validTemplates, templatesOverlimit} = checkLimits(extensionTemplates, specifications, app)

  return {
    templateType: extensionTemplate?.identifier,
    name: options.name,
    extensionFlavor: options.flavor as ExtensionFlavorValue,
    directory: joinPath(options.directory, 'extensions'),
    app,
    extensionTemplates: validTemplates ?? [],
    unavailableExtensions: templatesOverlimit ?? [],
    reset: options.reset,
  }
}

function checkLimits(
  extensionTemplates: ExtensionTemplate[],
  specifications: ExtensionSpecification[],
  app: AppInterface,
) {
  const iterateeFunction = (template: ExtensionTemplate) => {
    const allValid = template.types.every((type) => !limitReached(app, specifications, type))
    return allValid ? 'validTemplates' : 'templatesOverlimit'
  }
  return groupBy(extensionTemplates, iterateeFunction)
}

function limitReached(app: AppInterface, specifications: ExtensionSpecification[], templateType: TemplateType) {
  const type = templateType.type
  const specification = specifications.find((spec) => spec.identifier === type || spec.externalIdentifier === type)
  const existingExtensions = app.extensionsForType({identifier: type, externalIdentifier: type})
  return existingExtensions.length >= (specification?.registrationLimit || 1)
}

async function saveAnalyticsMetadata(promptAnswers: GenerateExtensionPromptOutput, typeFlag: string | undefined) {
  await Promise.all(
    promptAnswers.extensionContent.map((extensionContent) => {
      return metadata.addPublicMetadata(() => ({
        cmd_scaffold_template_flavor: extensionContent.flavor,
        cmd_scaffold_type: promptAnswers.extensionTemplate.identifier,
        cmd_scaffold_used_prompts_for_type: !typeFlag,
      }))
    }),
  )
}

function buildGenerateOptions(
  promptAnswers: GenerateExtensionPromptOutput,
  app: AppInterface,
  options: GenerateOptions,
): GenerateExtensionTemplateOptions {
  return {
    app,
    cloneUrl: options.cloneUrl,
    extensionChoices: promptAnswers.extensionContent,
    extensionTemplate: promptAnswers.extensionTemplate,
  }
}

function renderSuccessMessages(
  generatedExtensions: GeneratedExtension[],
  packageManager: AppInterface['packageManager'],
) {
  generatedExtensions.forEach((extension) => {
    const formattedSuccessfulMessage = formatSuccessfulRunMessage(
      extension.extensionTemplate,
      extension.directory,
      packageManager,
    )
    renderSuccess(formattedSuccessfulMessage)
  })
}

function validateExtensionFlavor(extensionTemplate?: ExtensionTemplate, flavor?: string) {
  if (!flavor || !extensionTemplate) return

  const possibleFlavors: string[] = extensionTemplate.types[0]!.supportedFlavors.map((flavor) => flavor.value as string)

  if (!possibleFlavors.includes(flavor)) {
    throw new AbortError(
      'Invalid template for extension type',
      `Expected template to be one of the following: ${possibleFlavors.join(', ')}.`,
    )
  }
}

function formatSuccessfulRunMessage(
  extensionTemplate: ExtensionTemplate,
  extensionDirectory: string,
  depndencyManager: PackageManager,
): RenderAlertOptions {
  const options: RenderAlertOptions = {
    headline: ['Your extension was created in', {filePath: extensionDirectory}, {char: '.'}],
    nextSteps: [],
    reference: [],
  }

  if (extensionTemplate.types.some((type) => type.type !== 'function')) {
    options.nextSteps!.push([
      'To preview this extension along with the rest of the project, run',
      {command: `${formatPackageManagerCommand(depndencyManager, 'dev')}`},
    ])
  }

  if (extensionTemplate.supportLinks[0]) {
    options.reference!.push([
      'For more details, see the',
      {link: {label: 'docs', url: extensionTemplate.supportLinks[0]}},
    ])
  }

  return options
}

async function handleTypeParameter(
  typeFlag: string | undefined,
  app: AppInterface,
  extensionTemplates: ExtensionTemplate[],
  specifications: ExtensionSpecification[],
): Promise<ExtensionTemplate | undefined> {
  if (!typeFlag) return

  const extensionTemplate = extensionTemplates.find((spec) => spec.identifier === typeFlag)

  if (!extensionTemplate) {
    const isShopifolk = await isShopify()
    const allExternalTypes = extensionTemplates.map((spec) => spec.identifier)
    const tryMsg = isShopifolk ? 'You might need to enable some beta flags on your Organization or App' : undefined
    throw new AbortError(
      `Unknown extension type: ${typeFlag}.\nThe following extension types are supported: ${allExternalTypes.join(
        ', ',
      )}`,
      tryMsg,
    )
  }

  // Validate limits for selected type.
  // If no type is selected, filter out any types that have reached their limit
  extensionTemplate.types.forEach((type) => {
    if (limitReached(app, specifications, type)) {
      throw new AbortError(
        `Invalid extension type: ${typeFlag}`,
        `You have reached the limit of extension(s) of type ${type.type} per app`,
      )
    }
  })

  return extensionTemplate
}

export default generate
