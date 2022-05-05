import {ui} from '@shopify/cli-kit'
import {extensions, ExtensionTypes} from '$cli/constants'

interface ScaffoldExtensionOptions {
  name?: string
  extensionType?: ExtensionTypes
  ignoreExtensions?: string[]
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
      choices: extensions.types.filter((type) => !options.ignoreExtensions.includes(type)),
    })
  }
  const promptOutput: ScaffoldExtensionOutput = await prompt(questions)
  return {...options, ...promptOutput}
}

export default scaffoldExtensionPrompt
