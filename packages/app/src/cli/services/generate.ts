import {fetchExtensionTemplates} from './generate/fetch-template-specifications.js'
import {
  GenerateExtensionTemplateOptions,
  generateExtensionTemplate,
  ExtensionFlavorValue,
} from './generate/extension.js'
import {GenerateExtensionResult} from './generate/extension/types.js'
import {DeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {AppInterface, AppLinkedInterface} from '../models/app/app.js'
import {Project} from '../models/project/project.js'
import generateExtensionPrompts, {
  GenerateExtensionPromptOptions,
  GenerateExtensionPromptOutput,
} from '../prompts/generate/extension.js'
import metadata from '../metadata.js'
import {ExtensionTemplate} from '../models/app/template.js'
import {ExtensionSpecification, RemoteAwareExtensionSpecification} from '../models/extensions/specification.js'
import {OrganizationApp} from '../models/organization.js'
import {isShopify} from '@shopify/cli-kit/node/context/local'
import {joinPath} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'
import {groupBy} from '@shopify/cli-kit/common/collection'

interface GenerateOptions {
  app: AppLinkedInterface
  project: Project
  specifications: RemoteAwareExtensionSpecification[]
  remoteApp: OrganizationApp
  developerPlatformClient: DeveloperPlatformClient
  directory: string
  reset: boolean
  template?: string
  flavor?: string
  name?: string
  cloneUrl?: string
}

async function generate(options: GenerateOptions): Promise<GenerateExtensionResult> {
  const {app, developerPlatformClient, remoteApp, specifications, template} = options

  const availableSpecifications = specifications.map((spec) => spec.identifier)
  const {templates: extensionTemplates, groupOrder} = await fetchExtensionTemplates(
    developerPlatformClient,
    remoteApp,
    availableSpecifications,
    {requestedTemplate: template},
  )

  const promptOptions = await buildPromptOptions(extensionTemplates, groupOrder, specifications, app, options)
  const promptAnswers = await generateExtensionPrompts(promptOptions)

  await saveAnalyticsMetadata(promptAnswers, template)

  const generateExtensionOptions = buildGenerateOptions(promptAnswers, app, options, developerPlatformClient)
  const generatedExtension = await generateExtensionTemplate(generateExtensionOptions)

  return {
    status: 'success',
    extension: {
      directory: generatedExtension.directory,
      extensionTemplate: generatedExtension.extensionTemplate,
      name: promptAnswers.extensionContent.name,
      flavor: promptAnswers.extensionContent.flavor,
    },
    packageManager: options.project.packageManager,
  }
}

async function buildPromptOptions(
  extensionTemplates: ExtensionTemplate[],
  groupOrder: string[],
  specifications: ExtensionSpecification[],
  app: AppInterface,
  options: GenerateOptions,
): Promise<GenerateExtensionPromptOptions> {
  const extensionTemplate = await handleTypeParameter(options.template, app, extensionTemplates, specifications)
  validateExtensionFlavor(extensionTemplate ? [extensionTemplate] : extensionTemplates, options.flavor)

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
    groupOrder,
  }
}

function checkLimits(
  extensionTemplates: ExtensionTemplate[],
  specifications: ExtensionSpecification[],
  app: AppInterface,
) {
  const iterateeFunction = (template: ExtensionTemplate) => {
    const allValid = !limitReached(app, specifications, template)
    return allValid ? 'validTemplates' : 'templatesOverlimit'
  }
  return groupBy(extensionTemplates, iterateeFunction)
}

function limitReached(app: AppInterface, specifications: ExtensionSpecification[], template: ExtensionTemplate) {
  const type = template.type
  const specification = specifications.find((spec) => spec.identifier === type || spec.externalIdentifier === type)
  const existingExtensions = app.extensionsForType({identifier: type, externalIdentifier: type})
  return existingExtensions.length >= (specification?.registrationLimit ?? 1)
}

async function saveAnalyticsMetadata(promptAnswers: GenerateExtensionPromptOutput, typeFlag: string | undefined) {
  const {extensionContent} = promptAnswers
  return metadata.addPublicMetadata(() => ({
    cmd_scaffold_template_flavor: extensionContent.flavor,
    cmd_scaffold_type: promptAnswers.extensionTemplate.identifier,
    cmd_scaffold_used_prompts_for_type: !typeFlag,
  }))
}

function buildGenerateOptions(
  promptAnswers: GenerateExtensionPromptOutput,
  app: AppLinkedInterface,
  options: GenerateOptions,
  developerPlatformClient: DeveloperPlatformClient,
): GenerateExtensionTemplateOptions {
  return {
    app,
    project: options.project,
    cloneUrl: options.cloneUrl,
    extensionChoices: promptAnswers.extensionContent,
    extensionTemplate: promptAnswers.extensionTemplate,
    developerPlatformClient,
  }
}

function validateExtensionFlavor(extensionTemplates: ExtensionTemplate[], flavor?: string) {
  if (!flavor) return

  const possibleFlavors: string[] = [
    ...new Set(extensionTemplates.flatMap((template) => template.supportedFlavors.map((flavor) => flavor.value))),
  ]

  if (!possibleFlavors.includes(flavor)) {
    throw new AbortError(
      'Invalid extension flavor',
      `Expected flavor to be one of the following: ${possibleFlavors.join(', ')}.`,
    )
  }
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
    const tryMsg = isShopifolk ? 'You might need to enable some flags on your Organization or App' : undefined
    throw new AbortError(
      `Unknown extension type: ${typeFlag}.\nThe following extension types are supported: ${allExternalTypes.join(
        ', ',
      )}`,
      tryMsg,
    )
  }

  // Validate limits for selected type.
  // If no type is selected, filter out any types that have reached their limit
  if (limitReached(app, specifications, extensionTemplate)) {
    throw new AbortError(
      `Invalid extension type: ${typeFlag}`,
      `You have reached the limit of extension(s) of type ${extensionTemplate.type} per app`,
    )
  }

  return extensionTemplate
}

export default generate
