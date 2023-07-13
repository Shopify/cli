import {generateRandomNameForSubdirectory} from '@shopify/cli-kit/node/fs'
import {renderText, renderSelectPrompt, renderTextPrompt} from '@shopify/cli-kit/node/ui'

interface InitOptions {
  name?: string
  template?: string
  directory: string
}

interface InitOutput {
  name: string
  template: string
  // e.g. 'node', 'ruby', 'php'
  templateType: keyof typeof templateURLMap | 'custom'
}

// Eventually this list should be taken from a remote location
// That way we don't have to update the CLI every time we add a template
export const templateURLMap = {
  node: 'https://github.com/Shopify/shopify-app-template-node',
  php: 'https://github.com/Shopify/shopify-app-template-php',
  ruby: 'https://github.com/Shopify/shopify-app-template-ruby',
  none: 'https://github.com/Shopify/shopify-app-template-none',
} as const

const templateLabels: {[key: string]: string} = {
  none: 'none (build an app with extensions only)',
}

const init = async (options: InitOptions): Promise<InitOutput> => {
  let name = options.name
  let template = options.template

  const defaults = {
    name: await generateRandomNameForSubdirectory({suffix: 'app', directory: options.directory}),
    template: templateURLMap.node,
  } as const

  let welcomed = false

  if (!name) {
    renderText({text: '\nWelcome. Let’s get started by naming your app project. You can change it later.'})
    welcomed = true
    name = await renderTextPrompt({
      message: 'Your app project name?',
      defaultValue: defaults.name,
      validate: (value) => {
        if (value.length === 0) {
          return "App name can't be empty"
        }
        if (value.length > 30) {
          return 'Enter a shorter name (30 character max.)'
        }
        if (value.toLowerCase().includes('shopify')) {
          return "App name can't include the word 'shopify'"
        }
      },
    })
  }

  if (!template) {
    if (!welcomed) {
      renderText({text: '\nWelcome. Let’s get started by choosing a template for your app project.'})
      welcomed = true
    }
    template = await renderSelectPrompt({
      choices: Object.keys(templateURLMap).map((key) => {
        return {
          label: templateLabels[key] || key,
          value: key,
        }
      }),
      message: 'Which template would you like to use?',
      defaultValue: Object.keys(templateURLMap).find(
        (key) => templateURLMap[key as keyof typeof templateURLMap] === defaults.template,
      ),
    })
  }

  const templateIsPredefined = Object.prototype.hasOwnProperty.call(templateURLMap, template)
  const answers: InitOutput = {
    ...options,
    name,
    template,
    templateType: templateIsPredefined ? (template as keyof typeof templateURLMap) : 'custom',
  }

  const templateURL = templateURLMap[answers.template as keyof typeof templateURLMap]
  answers.template = templateURL || answers.template || defaults.template

  return answers
}

export default init
