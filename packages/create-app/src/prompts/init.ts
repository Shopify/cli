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
  // e.g. 'Remix'
  templateType: keyof typeof templateURLMap | 'custom'
}

// Eventually this list should be taken from a remote location
// That way we don't have to update the CLI every time we add a template
export const templateURLMap = {
  remix: 'https://github.com/Shopify/shopify-app-template-remix',
  none: 'https://github.com/Shopify/shopify-app-template-none',
} as const

const templateLabels = {
  remix: 'Start with Remix (recommended)',
  none: 'Start by adding your first extension',
} as const
const templateOptionsInOrder = ['remix', 'none'] as const

const init = async (options: InitOptions): Promise<InitOutput> => {
  let name = options.name
  let template = options.template

  const defaults = {
    name: await generateRandomNameForSubdirectory({suffix: 'app', directory: options.directory}),
    template: templateURLMap.remix,
  } as const

  let welcomed = false

  if (!name) {
    renderText({text: '\nWelcome. Let’s get started by naming your app project. You can change it later.'})
    welcomed = true
    name = await renderTextPrompt({
      message: 'Your project name?',
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
      choices: templateOptionsInOrder.map((key) => {
        return {
          label: templateLabels[key] || key,
          value: key,
        }
      }),
      message: 'Get started building your app:',
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
