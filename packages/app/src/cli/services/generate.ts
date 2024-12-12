import {fetchExtensionTemplates} from './generate/fetch-template-specifications.js'
import {workflowRegistry, WorkflowResult} from './generate/workflows/registry.js'
import {DeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {AppInterface, AppLinkedInterface} from '../models/app/app.js'
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
import {ExtensionTemplate} from '../models/app/template.js'
import {ExtensionSpecification, RemoteAwareExtensionSpecification} from '../models/extensions/specification.js'
import {OrganizationApp} from '../models/organization.js'
import {PackageManager} from '@shopify/cli-kit/node/node-package-manager'
import {isShopify} from '@shopify/cli-kit/node/context/local'
import {joinPath} from '@shopify/cli-kit/node/path'
import {RenderAlertOptions, renderSuccess} from '@shopify/cli-kit/node/ui'
import {AbortError} from '@shopify/cli-kit/node/error'
import {formatPackageManagerCommand} from '@shopify/cli-kit/node/output'
import {groupBy} from '@shopify/cli-kit/common/collection'

export interface GenerateOptions {
  app: AppLinkedInterface
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

async function generate(options: GenerateOptions) {
  const {app, developerPlatformClient, remoteApp, specifications, template} = options

  const availableSpecifications = specifications.map((spec) => spec.identifier)
  const extensionTemplates = await fetchExtensionTemplates(developerPlatformClient, remoteApp, availableSpecifications)

  const promptOptions = await buildPromptOptions(extensionTemplates, specifications, app, options)
  const promptAnswers = await generateExtensionPrompts(promptOptions)

  await saveAnalyticsMetadata(promptAnswers, template)

  const generateExtensionOptions = buildGenerateOptions(promptAnswers, app, options, developerPlatformClient)
  const generatedExtension = await generateExtensionTemplate(generateExtensionOptions)
  renderSuccessMessage(generatedExtension, app.packageManager)
  const workflow = workflowRegistry[generatedExtension.extensionTemplate.identifier]
  if (!workflow) {
    renderSuccessMessage(generatedExtension, app.packageManager)
  }

  const workflowResult = await workflow?.afterGenerate({
    generateOptions: options,
    generatedExtension,
    extensionTemplateOptions: generateExtensionOptions,
    extensionTemplates: extensionTemplates,
  })

  if (!workflowResult?.success) {
    //TODO: Cleanup extension?
  }

  renderSuccessMessage(generatedExtension, app.packageManager, workflowResult)
}

export async function buildPromptOptions(
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
    const allValid = !limitReached(app, specifications, template)
    return allValid ? 'validTemplates' : 'templatesOverlimit'
  }

  return groupBy(extensionTemplates, iterateeFunction)
}

function limitReached(app: AppInterface, specifications: ExtensionSpecification[], template: ExtensionTemplate) {
  const type = template.type
  const specification = specifications.find((spec) => spec.identifier === type || spec.externalIdentifier === type)
  const existingExtensions = app.extensionsForType({identifier: type, externalIdentifier: type})
  return existingExtensions.length >= (specification?.registrationLimit || 1)
}

async function saveAnalyticsMetadata(promptAnswers: GenerateExtensionPromptOutput, typeFlag: string | undefined) {
  const {extensionContent} = promptAnswers
  return metadata.addPublicMetadata(() => ({
    cmd_scaffold_template_flavor: extensionContent.flavor,
    cmd_scaffold_type: promptAnswers.extensionTemplate.identifier,
    cmd_scaffold_used_prompts_for_type: !typeFlag,
  }))
}

export function buildGenerateOptions(
  promptAnswers: GenerateExtensionPromptOutput,
  app: AppInterface,
  options: GenerateOptions,
  developerPlatformClient: DeveloperPlatformClient,
): GenerateExtensionTemplateOptions {
  return {
    app,
    cloneUrl: options.cloneUrl,
    extensionChoices: promptAnswers.extensionContent,
    extensionTemplate: promptAnswers.extensionTemplate,
    developerPlatformClient,
  }
}

function renderSuccessMessage(
  extension: GeneratedExtension,
  packageManager: AppInterface['packageManager'],
  workflowResult?: WorkflowResult,
) {
  const formattedSuccessfulMessage = formatSuccessfulRunMessage(
    extension.extensionTemplate,
    extension.directory,
    packageManager,
    workflowResult,
  )
  renderSuccess(formattedSuccessfulMessage)
}

function validateExtensionFlavor(extensionTemplate?: ExtensionTemplate, flavor?: string) {
  if (!flavor || !extensionTemplate) return

  const possibleFlavors: string[] = extensionTemplate.supportedFlavors.map((flavor) => flavor.value as string)

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
  workflowResult?: WorkflowResult,
): RenderAlertOptions {
  const workflowMessage = workflowResult?.message
  const options: RenderAlertOptions = {
    headline: workflowMessage?.headline || [
      'Your extension was created in',
      {filePath: extensionDirectory},
      {char: '.'},
    ],
    nextSteps: workflowMessage?.nextSteps || [],
    reference: workflowMessage?.reference || [],
  }

  if (extensionTemplate.type !== 'function') {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    options.nextSteps!.push([
      'To preview this extension along with the rest of the project, run',
      {command: formatPackageManagerCommand(depndencyManager, 'shopify app dev')},
    ])
  }

  if (extensionTemplate.supportLinks[0]) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
