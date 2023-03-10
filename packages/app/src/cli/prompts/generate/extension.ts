import {extensionTypesGroups} from '../../constants.js'
import {AppInterface} from '../../models/app/app.js'
import {GenericSpecification} from '../../models/app/extensions.js'
import {TemplateSpecification} from '../../api/graphql/template_specifications.js'
import {getExtensionSpecificationsFromTemplate} from '../../models/extensions/templates.js'
import {generateRandomNameForSubdirectory} from '@shopify/cli-kit/node/fs'
import {renderSelectPrompt, renderTextPrompt} from '@shopify/cli-kit/node/ui'
import {outputWarn} from '@shopify/cli-kit/node/output'
import {createRequire} from 'module'

const require = createRequire(import.meta.url)

interface GenerateExtensionOptions {
  name?: string
  extensionType?: string
  templateType?: string
  extensionFlavor?: string
  directory: string
  app: AppInterface
  extensionSpecifications: GenericSpecification[]
  templateSpecifications: TemplateSpecification[]
  unavailableExtensions: string[]
  reset: boolean
}

interface GenerateExtensionOutput {
  name: string
  template: boolean
  extensionContent: GenerateExtensionContentOutput[]
}
interface GenerateExtensionContentOutput {
  name: string
  specification: GenericSpecification
  extensionFlavor?: string
}

export function buildChoices(specifications: GenericSpecification[], templateSpecifications: TemplateSpecification[]) {
  const extensionsSpecChoices = specifications.map((spec) => {
    return {
      label: spec.externalName,
      value: {id: spec.identifier, template: false, name: spec.externalIdentifier},
      group: spec.group || extensionTypesGroups.find((group) => includes(group.extensions, spec.identifier))?.name,
    }
  })
  const templateSpecChoices = templateSpecifications.map((spec) => {
    return {
      label: spec.name,
      value: {id: spec.identifier, template: true, name: spec.name},
      group: spec.group || extensionTypesGroups.find((group) => includes(group.extensions, spec.identifier))?.name,
    }
  })
  return extensionsSpecChoices.concat(templateSpecChoices).sort((c1, c2) => c1.label.localeCompare(c2.label))
}

const generateExtensionPrompt = async (options: GenerateExtensionOptions): Promise<GenerateExtensionOutput> => {
  let allExtensions = options.extensionSpecifications
  const extensionType = options.extensionType
  const templateType = options.templateType
  const name = options.name
  const extensionFlavor = options.extensionFlavor
  let selection: {id?: string; template: boolean; name: string} = extensionType
    ? {id: extensionType, template: false, name: ''}
    : {id: templateType, template: true, name: ''}

  if (!extensionType && !templateType) {
    if (extensionFlavor) {
      allExtensions = allExtensions.filter((spec) =>
        spec.supportedFlavors.map((elem) => elem.value as string).includes(extensionFlavor),
      )
    }

    if (options.unavailableExtensions.length > 0) {
      outputWarn(
        `You've reached the limit for these types of extensions: ${options.unavailableExtensions.join(', ')}\n`,
      )
    }

    selection = await renderSelectPrompt({
      message: 'Type of extension?',
      choices: buildChoices(allExtensions, options.templateSpecifications),
    })
  }

  let specifications: GenericSpecification[] = []
  if (selection?.template) {
    const templateSpecification = options.templateSpecifications.find((spec) => spec.identifier === selection?.id)!
    specifications = getExtensionSpecificationsFromTemplate(templateSpecification)
  } else {
    specifications = [options.extensionSpecifications.find((spec) => spec.identifier === selection?.id)!]
  }

  const nameAndFlavors: {name: string; flavor: string; specification: GenericSpecification}[] = []
  for (const spec of specifications) {
    // eslint-disable-next-line no-await-in-loop
    nameAndFlavors.push(await promptNameAndFlavor(options, spec))
  }

  return {
    name: selection?.name ?? '',
    template: selection?.template ?? false,
    extensionContent: nameAndFlavors.map((nameAndFlavor) => {
      return {
        ...options,
        name: nameAndFlavor.name,
        specification: nameAndFlavor.specification,
        extensionFlavor: nameAndFlavor.flavor,
      }
    }),
  }
}

async function promptNameAndFlavor(
  options: GenerateExtensionOptions,
  specification: GenericSpecification,
): Promise<{name: string; flavor: string; specification: GenericSpecification}> {
  const result = {
    name: options.name ?? '',
    flavor: options.extensionFlavor ?? specification.supportedFlavors[0]?.value ?? '',
    specification,
  }
  if (!options.name) {
    result.name = await renderTextPrompt({
      message: 'Extension name (internal only)',
      defaultValue: await generateRandomNameForSubdirectory({suffix: 'ext', directory: options.directory}),
    })
  }
  if (!options.extensionFlavor && specification.supportedFlavors.length > 1) {
    result.flavor = await renderSelectPrompt({
      message: 'What would you like to work in?',
      choices: specification.supportedFlavors.map((flavor) => {
        return {
          label: flavor.name,
          value: flavor.value,
        }
      }),
      defaultValue: 'react',
    })
  }
  return result
}

function includes<TNarrow extends TWide, TWide>(coll: ReadonlyArray<TNarrow>, el: TWide): el is TNarrow {
  return coll.includes(el as TNarrow)
}

export default generateExtensionPrompt
