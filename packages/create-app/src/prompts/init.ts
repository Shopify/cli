import {ui} from '@shopify/cli-kit'

interface InitOptions {
  name?: string
  template?: string
}

interface InitOutput {
  name: string
  template: string
}

const init = async (options: InitOptions, prompt = ui.prompt): Promise<InitOutput> => {
  const questions: ui.Question[] = []
  if (!options.name) {
    questions.push({
      type: 'input',
      name: 'name',
      message: "Your app's working name?",
      default: 'app',
      validate: (value) => {
        if (value.length === 0) {
          return 'App Name cannot be empty'
        }
        if (value.length > 30) {
          return 'App name is too long (maximum is 30 characters)'
        }
        return true
      },
    })
  }
  if (!options.template) {
    questions.push({
      type: 'select',
      name: 'template',
      choices: ['node', 'rails'],
      message: 'Which template would you like to use?',
      default: 'https://github.com/Shopify/shopify-app-node#richard/frontend-via-submodules',
    })
  }
  const promptOutput: InitOutput = await prompt(questions)
  return {
    ...options,
    ...promptOutput,
    template: 'https://github.com/Shopify/shopify-app-node#richard/frontend-via-submodules',
  }
}

export default init
