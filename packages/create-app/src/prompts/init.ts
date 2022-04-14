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

  // Eventually this list should be taken from a remote location
  // That way we don't have to update the CLI every time we add a template
  const templateURLMap = {
    node: 'https://github.com/Shopify/starter-node-app',
    php: 'https://github.com/Shopify/starter-node-app',
  }

  if (!options.template) {
    questions.push({
      type: 'select',
      name: 'template',
      choices: Object.keys(templateURLMap),
      message: 'Which template would you like to use?',
      default: 'https://github.com/Shopify/starter-node-app',
    })
  }

  const promptOutput: InitOutput = await prompt(questions)
  const answers = {
    ...options,
    ...promptOutput,
  }

  const templateURL = templateURLMap[answers.template as keyof typeof templateURLMap]
  answers.template = templateURL || answers.template

  return answers
}

export default init
