import {ensureGenerateContext} from './context.js'
import {fetchSpecifications} from './generate/fetch-extension-specifications.js'
import {fetchTemplateSpecifications} from './generate/fetch-template-specifications.js'
import {AppInterface} from '../models/app/app.js'
import {load as loadApp} from '../models/app/loader.js'
import {GenericSpecification} from '../models/app/extensions.js'
import generateExtensionPrompt from '../prompts/generate/extension.js'
import metadata from '../metadata.js'
import generateExtensionService, {ExtensionFlavorValue} from '../services/generate/extension.js'
import {loadFunctionSpecifications} from '../models/extensions/specifications.js'
import {
  convertSpecificationsToTemplate,
  getTypesExternalIdentitifier,
  getTypesExternalName,
  TemplateSpecification,
} from '../models/app/template.js'
import {PackageManager} from '@shopify/cli-kit/node/node-package-manager'
import {Config} from '@oclif/core'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {isShopify} from '@shopify/cli-kit/node/context/local'
import {joinPath} from '@shopify/cli-kit/node/path'
import {RenderAlertOptions, renderSuccess} from '@shopify/cli-kit/node/ui'
import {AbortError} from '@shopify/cli-kit/node/error'
import {formatPackageManagerCommand} from '@shopify/cli-kit/node/output'
import {groupBy} from '@shopify/cli-kit/common/collection'

export interface GenerateOptions {
  directory: string
  reset: boolean
  config: Config
  apiKey?: string
  type?: string
  template?: string
  name?: string
  cloneUrl?: string
}

async function generate(options: GenerateOptions) {
  const templateSpecifications = await getTemplateSpecifications(options)
  const app: AppInterface = await loadApp({
    directory: options.directory,
    specifications: templateSpecifications.flatMap((templateSpecification) => templateSpecification.types) ?? [],
  })

  const templateSpecification = await handleTypeParameter(options.type, app, templateSpecifications)
  validateExtensionFlavor(templateSpecification, options.template)

  const {validTemplateSpecifications, templatesOverlimit} = groupBy(templateSpecifications, (spec) =>
    spec.types.every((extension) => app.extensionsForType(extension).length < extension.registrationLimit)
      ? 'validTemplateSpecifications'
      : 'templatesOverlimit',
  )

  const promptAnswers = await generateExtensionPrompt({
    templateType: templateSpecification?.identifier,
    name: options.name,
    extensionFlavor: options.template,
    directory: joinPath(options.directory, 'extensions'),
    app,
    templateSpecifications: validTemplateSpecifications ?? [],
    unavailableExtensions: getTypesExternalName(templatesOverlimit ?? []),
    reset: options.reset,
  })

  await Promise.all(
    promptAnswers.extensionContent.map((extensionContent) => {
      return metadata.addPublicMetadata(() => ({
        cmd_scaffold_template_flavor: extensionContent.extensionFlavor,
        cmd_scaffold_type: extensionContent.specification.identifier,
        cmd_scaffold_type_category: extensionContent.specification.category(),
        cmd_scaffold_type_gated: extensionContent.specification.gated,
        cmd_scaffold_used_prompts_for_type: extensionContent.specification.identifier !== options.type,
      }))
    }),
  )

  const generatedExtensions = await generateExtensionService(
    promptAnswers.extensionContent.map((extensionContent) => {
      return {
        name: extensionContent.name,
        extensionFlavor: extensionContent.extensionFlavor as ExtensionFlavorValue,
        specification: extensionContent.specification,
        app,
        extensionType: extensionContent.specification.identifier,
        cloneUrl: options.cloneUrl,
      }
    }),
  )

  generatedExtensions.forEach((extension) => {
    const formattedSuccessfulMessage = formatSuccessfulRunMessage(
      extension.specification,
      extension.directory,
      app.packageManager,
    )
    renderSuccess(formattedSuccessfulMessage)
  })
}

function findTemplateSpecification(type: string | undefined, specifications: TemplateSpecification[]) {
  // To support legacy extensions specs, we need to check both the identifier and the external identifier
  return specifications.find((spec) =>
    spec.types.some((extension) => extension.identifier === type || extension.externalIdentifier === type),
  )
}

function validateExtensionFlavor(templateSpecification?: TemplateSpecification, flavor?: string) {
  if (!flavor || !templateSpecification) return

  const possibleFlavors: string[] = templateSpecification.types[0]!.supportedFlavors.map(
    (flavor) => flavor.value as string,
  )

  if (!possibleFlavors.includes(flavor)) {
    throw new AbortError(
      'Invalid template for extension type',
      `Expected template to be one of the following: ${possibleFlavors.join(', ')}.`,
    )
  }
}

function formatSuccessfulRunMessage(
  specification: GenericSpecification,
  extensionDirectory: string,
  depndencyManager: PackageManager,
): RenderAlertOptions {
  const options: RenderAlertOptions = {
    headline: ['Your extension was created in', {filePath: extensionDirectory}, {char: '.'}],
    nextSteps: [],
    reference: [],
  }

  if (specification.category() === 'ui' || specification.category() === 'theme') {
    options.nextSteps!.push([
      'To preview this extension along with the rest of the project, run',
      {command: `${formatPackageManagerCommand(depndencyManager, 'dev')}`},
    ])
  }

  if (specification.helpURL) {
    options.reference!.push(['For more details, see the', {link: {label: 'docs', url: specification.helpURL}}])
  }

  return options
}

async function handleTypeParameter(
  type: string | undefined,
  app: AppInterface,
  templateSpecifications: TemplateSpecification[],
): Promise<TemplateSpecification | undefined> {
  if (!type) return

  const templateSpecification = findTemplateSpecification(type, templateSpecifications)

  if (!templateSpecification) {
    const isShopifolk = await isShopify()
    const allExternalTypes = getTypesExternalIdentitifier(templateSpecifications)
    const tryMsg = isShopifolk ? 'You might need to enable some beta flags on your Organization or App' : undefined
    throw new AbortError(
      `Unknown extension type: ${type}.\nThe following extension types are supported: ${allExternalTypes.join(', ')}`,
      tryMsg,
    )
  }

  // Validate limits for selected type.
  // If no type is selected, filter out any types that have reached their limit
  templateSpecification.types.forEach((spec) => {
    const existing = app.extensionsForType(spec)
    const limit = spec.registrationLimit
    if (existing.length >= limit) {
      throw new AbortError(
        'Invalid extension type',
        `You can only generate ${limit} extension(s) of type ${spec.externalIdentifier} per app`,
      )
    }
  })

  return templateSpecification
}

async function getTemplateSpecifications(options: GenerateOptions): Promise<TemplateSpecification[]> {
  const token = await ensureAuthenticatedPartners()
  const apiKey = await ensureGenerateContext({...options, token})
  const specifications = await fetchSpecifications({token, apiKey, config: options.config})
  let templateSpecifications = convertSpecificationsToTemplate(specifications)
  const remoteTemplateSpecifications = await fetchTemplateSpecifications(token)
  templateSpecifications = templateSpecifications.concat(remoteTemplateSpecifications)
  // If for any reason the remote template specifications API with the functions is not available, we will load the
  // local functions specifications
  if (remoteTemplateSpecifications.length === 0) {
    const functions = await loadFunctionSpecifications(options.config)
    templateSpecifications = templateSpecifications.concat(convertSpecificationsToTemplate(functions))
  }
  return templateSpecifications
}

export default generate
