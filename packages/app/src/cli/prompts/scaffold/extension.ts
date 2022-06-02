import {
  extensions,
  ExtensionTypes,
  functionExtensions,
  getExtensionOutputConfig,
  themeExtensions,
  uiExtensions,
} from '../../constants'
import {ui} from '@shopify/cli-kit'

interface ScaffoldExtensionOptions {
  name?: string
  extensionType?: string
  extensionTypesAlreadyAtQuota: string[]
}

interface ScaffoldExtensionOutput {
  name: string
  extensionType: ExtensionTypes
}

const scaffoldExtensionPrompt = async (
  options: ScaffoldExtensionOptions,
  prompt = ui.prompt,
): Promise<ScaffoldExtensionOutput> => {
  const questions: ui.Question[] = []
  if (!options.extensionType) {
    questions.push({
      type: 'select',
      name: 'extensionType',
      message: 'Type of extension?',
      choices: extensions.types
        .filter((type) => !options.extensionTypesAlreadyAtQuota.includes(type))
        .map((type) => ({
          name: getExtensionOutputConfig(type).humanKey,
          value: type,
        }))
        .sort(extensionTypeChoiceSorterByGroupAndName),
    })
  }
  if (!options.name) {
    questions.push({
      type: 'input',
      name: 'name',
      message: "Your extension's working name?",
      default: 'extension',
    })
  }
  const promptOutput: ScaffoldExtensionOutput = await prompt(questions)
  return {...options, ...promptOutput}
}

/**
 * Sorting method for prompt choices that sort alphabetically extensions showing first the UI ones
 * and lastest the function ones
 */
export const extensionTypeChoiceSorterByGroupAndName = (
  c1: {name: string; value: string},
  c2: {name: string; value: string},
) => {
  if (
    (includes(uiExtensions.types, c1.value) || includes(themeExtensions.types, c1.value)) &&
    includes(functionExtensions.types, c2.value)
  ) {
    return -1
  } else if (
    includes(functionExtensions.types, c1.value) &&
    (includes(uiExtensions.types, c2.value) || includes(themeExtensions.types, c2.value))
  ) {
    return 1
  }
  return c1.name.localeCompare(c2.name)
}

// eslint-disable-next-line @typescript-eslint/naming-convention
function includes<T extends U, U>(coll: ReadonlyArray<T>, el: U): el is T {
  return coll.includes(el as T)
}

export default scaffoldExtensionPrompt
