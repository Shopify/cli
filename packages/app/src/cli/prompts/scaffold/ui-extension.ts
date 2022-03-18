import {uiExtensions, UiExtensionTypes} from '../../constants'
import {ui} from '@shopify/cli-kit'

interface ScaffoldUiExtensionOptions {
  name?: string
  uiExtensionType?: UiExtensionTypes
}

interface ScaffoldUiExtensionOutput {
  name: string
  uiExtensionType: UiExtensionTypes
}

const scaffoldUiExtensionPrompt = async (
  options: ScaffoldUiExtensionOptions,
  prompt = ui.prompt,
): Promise<ScaffoldUiExtensionOutput> => {
  const questions: ui.Question[] = []
  if (!options.name) {
    questions.push({
      type: 'input',
      name: 'name',
      message: "Your UI extension's working name?",
      default: 'extension',
    })
  }
  if (!options.uiExtensionType) {
    questions.push({
      type: 'select',
      name: 'uiExtensionType',
      message: 'Type of UI extension?',
      choices: uiExtensions.types,
    })
  }
  const promptOutput: ScaffoldUiExtensionOutput = await prompt(questions)
  return {...options, ...promptOutput}
}

export default scaffoldUiExtensionPrompt
