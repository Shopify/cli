import {AppInterface} from '../../models/app/app.js'
import {ExtensionFlavorValue} from '../../services/generate/extension.js'
import {ExtensionTemplate, TemplateType} from '../../models/app/template.js'
import {fileExistsSync} from '@shopify/cli-kit/node/fs'
import {renderAutocompletePrompt, renderSelectPrompt, renderTextPrompt} from '@shopify/cli-kit/node/ui'
import {AbortError} from '@shopify/cli-kit/node/error'
import {joinPath} from '@shopify/cli-kit/node/path'
import {slugify} from '@shopify/cli-kit/common/string'

export interface GenerateExtensionPromptOptions {
  name?: string
  templateType?: string
  extensionFlavor?: ExtensionFlavorValue
  directory: string
  app: AppInterface
  extensionTemplates: ExtensionTemplate[]
  unavailableExtensions: ExtensionTemplate[]
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

export function buildChoices(extensionTemplates: ExtensionTemplate[], unavailableExtensions: ExtensionTemplate[] = []) {
  type ArrElement<TArrType> = TArrType extends ReadonlyArray<infer ElementType> ? ElementType : never

  const templateSpecChoices = [
    ...extensionTemplates.map((spec) => {
      return {
        label: spec.name,
        value: spec.identifier,
        group: spec.group || 'Other',
        sortPriority: spec.sortPriority ?? Number.MAX_SAFE_INTEGER,
      }
    }),
    ...unavailableExtensions.map((spec) => {
      const label = `${spec.name} (limit reached)`
      return {
        label,
        value: spec.identifier,
        group: spec.group || 'Other',
        disabled: true,
        sortPriority: spec.sortPriority ?? Number.MAX_SAFE_INTEGER,
      }
    }),
  ]

  const compareChoices = (c1: ArrElement<typeof templateSpecChoices>, c2: ArrElement<typeof templateSpecChoices>) => {
    if (c1.sortPriority === c2.sortPriority) {
      return c1.label.localeCompare(c2.label)
    } else {
      return c1.sortPriority - c2.sortPriority
    }
  }

  return templateSpecChoices.sort(compareChoices)
}

const generateExtensionPrompts = async (
  options: GenerateExtensionPromptOptions,
): Promise<GenerateExtensionPromptOutput> => {
  let extensionTemplates = options.extensionTemplates
  let templateType = options.templateType
  const extensionFlavor = options.extensionFlavor

  if (!templateType) {
    if (extensionFlavor) {
      extensionTemplates = extensionTemplates.filter((template) =>
        template.types[0]?.supportedFlavors.map((elem) => elem.value as string).includes(extensionFlavor),
      )
    }

    if (extensionTemplates.length === 0) {
      throw new AbortError('You have reached the limit for the number of extensions you can create.')
    }

    // eslint-disable-next-line require-atomic-updates
    templateType = await renderAutocompletePrompt({
      message: 'Type of extension?',
      choices: buildChoices(extensionTemplates, options.unavailableExtensions),
    })
  }

  const extensionTemplate = extensionTemplates.find((template) => template.identifier === templateType)!

  const extensionContent: GenerateExtensionContentOutput[] = []
  /* eslint-disable no-await-in-loop */
  for (const [index, templateType] of extensionTemplate.types.entries()) {
    const name =
      (extensionTemplate.types.length === 1 && options.name) ||
      (await promptName(options.directory, extensionTemplate.defaultName))
    const flavor = options.extensionFlavor ?? (await promptFlavor(templateType))
    extensionContent.push({index, name, flavor})
  }
  /* eslint-enable no-await-in-loop */

  return {extensionTemplate, extensionContent}
}

async function promptName(directory: string, defaultName: string, number = 1): Promise<string> {
  const separator = defaultName.includes(' ') ? ' ' : '-'
  const name = number <= 1 ? defaultName : `${defaultName}${separator}${number}`
  const fullPath = joinPath(directory, slugify(name))

  if (fileExistsSync(fullPath)) {
    return promptName(directory, defaultName, number + 1)
  }
  return renderTextPrompt({
    message: 'Name your extension:',
    defaultValue: name,
  })
}

async function promptFlavor(templateType: TemplateType): Promise<ExtensionFlavorValue | undefined> {
  if (templateType.supportedFlavors.length === 0) {
    return undefined
  }

  if (templateType.supportedFlavors.length === 1 && templateType.supportedFlavors[0]) {
    return templateType.supportedFlavors[0].value
  }

  return renderSelectPrompt({
    message: 'What would you like to work in?',
    choices: templateType.supportedFlavors.map((flavor) => {
      return {
        label: flavor.name,
        value: flavor.value,
      }
    }),
    defaultValue: 'react',
  })
}

export default generateExtensionPrompts
