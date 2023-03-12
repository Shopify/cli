import {AppInterface} from '../../models/app/app.js'
import {GenericSpecification} from '../../models/app/extensions.js'
import {TemplateSpecification} from '../../models/app/template.js'
import {generateRandomNameForSubdirectory} from '@shopify/cli-kit/node/fs'
import {renderSelectPrompt, renderTextPrompt} from '@shopify/cli-kit/node/ui'
import {outputWarn} from '@shopify/cli-kit/node/output'
import {createRequire} from 'module'

const require = createRequire(import.meta.url)

interface GenerateExtensionOptions {
  name?: string
  templateType?: string
  extensionFlavor?: string
  directory: string
  app: AppInterface
  templateSpecifications: TemplateSpecification[]
  unavailableExtensions: string[]
  reset: boolean
}

interface GenerateExtensionOutput {
  name: string
  extensionContent: GenerateExtensionContentOutput[]
}
interface GenerateExtensionContentOutput {
  name: string
  specification: GenericSpecification
  extensionFlavor?: string
}

export function buildChoices(templateSpecifications: TemplateSpecification[]) {
  const templateSpecChoices = templateSpecifications.map((spec) => {
    return {
      label: spec.name,
      value: spec.identifier,
      group: spec.group,
    }
  })
  return templateSpecChoices.sort((c1, c2) => c1.label.localeCompare(c2.label))
}

const generateExtensionPrompt = async (options: GenerateExtensionOptions): Promise<GenerateExtensionOutput> => {
  let templateSpecifications = options.templateSpecifications
  let templateType = options.templateType
  const extensionFlavor = options.extensionFlavor

  if (!templateType) {
    if (extensionFlavor) {
      templateSpecifications = templateSpecifications.filter((spec) =>
        spec.types[0]?.supportedFlavors.map((elem) => elem.value as string).includes(extensionFlavor),
      )
    }

    if (options.unavailableExtensions.length > 0) {
      outputWarn(
        `You've reached the limit for these types of extensions: ${options.unavailableExtensions.join(', ')}\n`,
      )
    }

    // eslint-disable-next-line require-atomic-updates
    templateType = await renderSelectPrompt({
      message: 'Type of extension?',
      choices: buildChoices(templateSpecifications),
    })
  }

  const templateSpecification = templateSpecifications.find((spec) => spec.identifier === templateType)!

  const nameAndFlavors: {name: string; flavor?: string; specification: GenericSpecification}[] = []
  for (const spec of templateSpecification.types) {
    // eslint-disable-next-line no-await-in-loop
    nameAndFlavors.push(await promptNameAndFlavor(options, spec))
  }

  return {
    name: templateSpecification?.name ?? '',
    extensionContent: nameAndFlavors.map((nameAndFlavor) => {
      return {
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
): Promise<{name: string; flavor?: string; specification: GenericSpecification}> {
  const result = {
    name: options.name ?? '',
    flavor: options.extensionFlavor ?? specification.supportedFlavors[0]?.value,
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

export default generateExtensionPrompt
