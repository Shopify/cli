import {
  extensions,
  ExtensionTypes,
  ExtensionTypesHumanKeys,
  getExtensionOutputConfig,
  getExtensionTypeFromHumanKey,
} from '../../constants'
import {ui} from '@shopify/cli-kit'

interface ScaffoldExtensionOptions {
  name?: string
  extensionType?: string
  extensionTypesAlreadyAtQuota: string[]
}

interface ScaffoldExtensionOutput {
  name: string
  extensionType: ExtensionTypes | ExtensionTypesHumanKeys
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
        .map((type) => getExtensionOutputConfig(type).humanKey)
        .sort(),
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
  return {
    ...options,
    name: promptOutput.name,
    extensionType: getExtensionTypeFromHumanKey(promptOutput.extensionType as ExtensionTypesHumanKeys),
  }
}

export default scaffoldExtensionPrompt
