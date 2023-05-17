import {AppInterface} from '../../models/app/app.js'
import {ExtensionFlavorValue} from '../../services/generate/extension.js'
import {ExtensionTemplate, TemplateType} from '../../models/app/template.js'
import {generateRandomNameForSubdirectory} from '@shopify/cli-kit/node/fs'
import {renderSelectPrompt, renderTextPrompt} from '@shopify/cli-kit/node/ui'
import {outputWarn} from '@shopify/cli-kit/node/output'
import {AbortError} from '@shopify/cli-kit/node/error'

export interface GenerateExtensionPromptOptions {
  name?: string
  templateType?: string
  extensionFlavor?: ExtensionFlavorValue
  directory: string
  app: AppInterface
  extensionTemplates: ExtensionTemplate[]
  unavailableExtensions: string[]
  reset: boolean
}

export interface GenerateExtensionPromptOutput {
  extensionTemplate: ExtensionTemplate
  extensionContent: GenerateExtensionContentOutput[]
}

export interface GenerateExtensionContentOutput {
  index: number
  name: string
  flavor?: ExtensionFlavorValue
}

export function buildChoices(extensionTemplates: ExtensionTemplate[]) {
  const templateSpecChoices = extensionTemplates.map((spec) => {
    return {
      label: spec.name,
      value: spec.identifier,
      group: spec.group || 'Other',
    }
  })
  return templateSpecChoices.sort((c1, c2) => c1.label.localeCompare(c2.label))
}

const generateExtensionPrompts = async (
  options: GenerateExtensionPromptOptions,
): Promise<GenerateExtensionPromptOutput> => {
  let templateSpecifications = options.extensionTemplates
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

    if (templateSpecifications.length === 0) {
      throw new AbortError('You have reached the limit for the number of extensions you can create.')
    }

    // eslint-disable-next-line require-atomic-updates
    templateType = await renderSelectPrompt({
      message: 'Type of extension?',
      choices: buildChoices(templateSpecifications),
    })
  }

  const templateSpecification = templateSpecifications.find((spec) => spec.identifier === templateType)!

  const extensionContent: GenerateExtensionContentOutput[] = []
  /* eslint-disable no-await-in-loop */
  for (const [index, spec] of templateSpecification.types.entries()) {
    const name = (templateSpecification.types.length === 1 && options.name) || (await promptName(options.directory))
    const flavor = options.extensionFlavor ?? (await promptFlavor(spec))
    extensionContent.push({index, name, flavor})
  }
  /* eslint-enable no-await-in-loop */

  return {extensionTemplate: templateSpecification, extensionContent}
}

async function promptName(directory: string): Promise<string> {
  return renderTextPrompt({
    message: 'Extension name (internal only)',
    defaultValue: await generateRandomNameForSubdirectory({suffix: 'ext', directory}),
  })
}

async function promptFlavor(specification: TemplateType): Promise<ExtensionFlavorValue | undefined> {
  if (specification.supportedFlavors.length === 0) {
    return undefined
  }

  if (specification.supportedFlavors.length === 1 && specification.supportedFlavors[0]) {
    return specification.supportedFlavors[0].value
  }

  return renderSelectPrompt({
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

export default generateExtensionPrompts
