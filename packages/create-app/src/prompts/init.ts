import {generateRandomNameForSubdirectory} from '@shopify/cli-kit/node/fs'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {renderSelectPrompt, renderTextPrompt} from '@shopify/cli-kit/node/ui'

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
  node: 'https://github.com/Shopify/shopify-app-template-node',
  php: 'https://github.com/Shopify/shopify-app-template-php',
  ruby: 'https://github.com/Shopify/shopify-app-template-ruby',
} as const

const init = async (options: InitOptions): Promise<InitOutput> => {
  let name = options.name
  let template = options.template

  const defaults = {
    name: await generateRandomNameForSubdirectory({suffix: 'app', directory: options.directory}),
    template: templateURLMap.node,
  } as const

  outputInfo('\nWelcome. Let’s get started by naming your app. You can change it later.\n')

  if (!name) {
    name = await renderTextPrompt({
      message: "Your app's name?",
      defaultValue: defaults.name,
      validate: (value) => {
        if (value.length === 0) {
          return "App Name can't be empty"
        }
        if (value.length > 30) {
          return 'Enter a shorter name (30 character max.)'
        }
        if (value.toLowerCase().includes('shopify')) {
          return "App Name can't include the word 'shopify'"
        }
      },
    })
  }

  if (!template) {
    template = await renderSelectPrompt({
      choices: Object.keys(templateURLMap).map((key) => {
        return {
          label: key,
          value: key,
        }
      }),
      message: 'Which template would you like to use?',
      defaultValue: Object.keys(templateURLMap).find(
        (key) => templateURLMap[key as 'node' | 'php' | 'ruby'] === defaults.template,
      ),
    })
  }

  const answers = {
    ...options,
    name,
    template,
  }

  const templateURL = templateURLMap[answers.template as keyof typeof templateURLMap]
  answers.template = templateURL || answers.template || defaults.template

  return answers
}

export default init
