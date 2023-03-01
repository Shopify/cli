import {generateRandomNameForSubdirectory} from '@shopify/cli-kit/node/fs'
import {renderText, renderSelectPrompt, renderTextPrompt} from '@shopify/cli-kit/node/ui'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'

interface InitOptions {
  name?: string
  template?: string
  directory: string
}

interface InitOutput {
  name: string
  template: string
}

export const templates = [
  {
    label: 'Snowdevil',
    description: 'Example of a Shop Mini using prebuilt components',
    value: 'snowboardz',
  },
  {
    label: 'Hello World',
    description: 'Prebuilt components you can play around with',
    value: 'hello_world',
  },
  {
    label: 'Blank',
    description: 'A blank canvas so you can create from scratch',
    value: 'blank',
  },
]

const init = async (options: InitOptions): Promise<InitOutput> => {
  let name = options.name
  let template = options.template

  const defaultName = await generateRandomNameForSubdirectory({suffix: 'mini', directory: options.directory})

  if (!name) {
    renderText({text: '\nWelcome. Let’s get started by naming your Shop Mini. You can change it later.'})
    name = await renderTextPrompt({
      message: "Your Shop Mini's name?",
      defaultValue: defaultName,
      validate: (value) => {
        if (value.length === 0) {
          return "Shop Mini name can't be empty"
        }
        if (value.length > 30) {
          return 'Enter a shorter name (30 character max.)'
        }
        if (value.toLowerCase().includes('shopify')) {
          return "Shop Mini name can't include the word 'shopify'"
        }
      },
    })
  }

  if (!template) {
    template = await renderSelectPrompt({
      choices: templates.map((template) => ({
        ...template,
        label: outputContent`${template.label} ${outputToken.italic(`(${template.description})`)}`.value,
      })),
      message: 'Which template would you like to use?',
    })
  }

  const answers = {
    ...options,
    name,
    template,
  }

  return answers
}

export default init
