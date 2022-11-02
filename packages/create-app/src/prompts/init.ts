import {ui} from '@shopify/cli-kit'
import {generateRandomNameForSubdirectory} from '@shopify/cli-kit/node/fs'

interface InitOptions {
  name?: string
  template?: string
  directory: string
}

interface InitOutput {
  name: string
  template: string
}

// Eventually this list should be taken from a remote location
// That way we don't have to update the CLI every time we add a template
export const templateURLMap = {
  node: 'https://github.com/Shopify/shopify-app-template-node#cli_three',
  php: 'https://github.com/Shopify/shopify-app-template-php#cli_three',
  ruby: 'https://github.com/Shopify/shopify-app-template-ruby',
} as const

const init = async (options: InitOptions, prompt = ui.prompt): Promise<InitOutput> => {
  const defaults = {
    name: await generateRandomNameForSubdirectory({suffix: 'app', directory: options.directory}),
    template: templateURLMap.node,
  } as const

  const questions: ui.Question<'name' | 'template'>[] = []
  if (!options.name) {
    questions.push({
      type: 'input',
      name: 'name',
      preface: '\nWelcome. Let’s get started by naming your app. You can change it later.',
      message: "Your app's name?",
      default: defaults.name,
      validate: (value) => {
        if (value.length === 0) {
          return "App Name can't be empty"
        }
        if (value.length > 30) {
          return 'Enter a shorter name (30 character max.)'
        }
        return true
      },
    })
  }

  if (!options.template && Object.keys(templateURLMap).length > 1) {
    const templateList = Object.keys(templateURLMap).map((key) => {
      return {
        name: key,
        value: key,
      }
    })
    questions.push({
      type: 'select',
      name: 'template',
      choices: templateList,
      message: 'Which template would you like to use?',
      default: defaults.template,
    })
  }

  const promptOutput: InitOutput = await prompt(questions)
  const answers = {
    ...options,
    ...promptOutput,
  }

  const templateURL = templateURLMap[answers.template as keyof typeof templateURLMap]
  answers.template = templateURL || answers.template || defaults.template

  return answers
}

export default init
