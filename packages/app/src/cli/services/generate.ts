import {ensureGenerateContext} from './context.js'
import {
  fetchSpecifications,
  fetchTemplateSpecifications,
  getExtensionSpecificationsFromTemplates,
} from './generate/fetch-extension-specifications.js'
import {AppInterface} from '../models/app/app.js'
import {load as loadApp} from '../models/app/loader.js'
import {GenericSpecification} from '../models/app/extensions.js'
import generateExtensionPrompt from '../prompts/generate/extension.js'
import metadata from '../metadata.js'
import generateExtensionService, {ExtensionFlavorValue} from '../services/generate/extension.js'
import {loadFunctionSpecifications} from '../models/extensions/specifications.js'
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
  const token = await ensureAuthenticatedPartners()
  const apiKey = await ensureGenerateContext({...options, token})
  let specificationsWithoutTemplates = await fetchSpecifications({token, apiKey, config: options.config})
  const templateSpecifications = await fetchTemplateSpecifications(token)
  // Another remote API should return the list of extensions expecifications including the function typed ones. In the
  // meanwhile they are extracted from the templateSpecifications
  let specifications = specificationsWithoutTemplates.concat(
    getExtensionSpecificationsFromTemplates(templateSpecifications),
  )
  // If for any reason the remote template specifications API with the functions is not available, we will load the
  // local functions specifications
  if (templateSpecifications.length === 0) {
    const functions = await loadFunctionSpecifications(options.config)
    specificationsWithoutTemplates = specificationsWithoutTemplates.concat(functions)
    specifications = specifications.concat(functions)
  }
  const app: AppInterface = await loadApp({
    directory: options.directory,
    specifications,
  })

  // If the user has specified a type, we need to validate it
  const specification = findSpecification(options.type, specificationsWithoutTemplates)
  const allExternalTypes = specificationsWithoutTemplates.map((spec) => spec.externalIdentifier)

  if (options.type && !specification) {
    const isShopifolk = await isShopify()
    const tryMsg = isShopifolk ? 'You might need to enable some beta flags on your Organization or App' : undefined
    throw new AbortError(
      `Unknown extension type: ${options.type}.\nThe following extension types are supported: ${allExternalTypes.join(
        ', ',
      )}`,
      tryMsg,
    )
  }

  // Validate limits for selected type.
  // If no type is selected, filter out any types that have reached their limit
  if (specification) {
    const existing = app.extensionsForType(specification)
    const limit = specification.registrationLimit
    if (existing.length >= limit) {
      throw new AbortError(
        'Invalid extension type',
        `You can only generate ${limit} extension(s) of type ${specification.externalIdentifier} per app`,
      )
    }
  }

  const {validSpecifications, overlimit} = groupBy(specificationsWithoutTemplates, (spec) =>
    app.extensionsForType(spec).length < spec.registrationLimit ? 'validSpecifications' : 'overlimit',
  )

  validateExtensionFlavor(specification, options.template)

  const promptAnswers = await generateExtensionPrompt({
    extensionType: specification?.identifier || options.type,
    name: options.name,
    extensionFlavor: options.template,
    directory: joinPath(options.directory, 'extensions'),
    app,
    extensionSpecifications: validSpecifications ?? [],
    templateSpecifications: templateSpecifications ?? [],
    unavailableExtensions: overlimit?.map((spec) => spec.externalName) ?? [],
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

function findSpecification(type: string | undefined, specifications: GenericSpecification[]) {
  return specifications.find((spec) => spec.identifier === type || spec.externalIdentifier === type)
}

function validateExtensionFlavor(specification: GenericSpecification | undefined, flavor: string | undefined) {
  if (!flavor || !specification) return

  const possibleFlavors = specification.supportedFlavors.map((flavor) => flavor.value as string)
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

export default generate
