import {extensions, ExtensionTypes} from '../../constants'
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
  if (!options.name) {
    questions.push({
      type: 'input',
      name: 'name',
      message: "Your extension's working name?",
      default: 'extension',
    })
  }
  if (!options.extensionType) {
    questions.push({
      type: 'select',
      name: 'extensionType',
      message: 'Type of extension?',
      choices: extensions.types.filter((type) => !options.extensionTypesAlreadyAtQuota.includes(type)),
    })
  }
  const promptOutput: ScaffoldExtensionOutput = await prompt(questions)
  return {...options, ...promptOutput}
}

export default scaffoldExtensionPrompt
