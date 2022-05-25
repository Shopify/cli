import {ui, string} from '@shopify/cli-kit'

export enum Template {
  Minimum = 'Hello world',
  Default = 'Demo store',
}

const TEMPLATE_BASE = 'Shopify/hydrogen/templates/'
const TEMPLATE_PREFIX = 'template-hydrogen-'
const TEMPLATE_MAP = {
  [Template.Default]: 'default',
  [Template.Minimum]: 'hello-world',
}

interface InitOptions {
  name?: string
  template?: string
}

const init = async (options: InitOptions, prompt = ui.prompt): Promise<Required<InitOptions>> => {
  const questions: ui.Question[] = []
  if (!options.name) {
    questions.push({
      type: 'input',
      name: 'name',
      message: 'Name your new Hydrogen storefront',
      default: 'hydrogen-app',
    })
  }

  let explicitTemplate

  if (options.template) {
    const normalizedTemplate = string.hyphenize(options.template)

    if (normalizedTemplate.startsWith(TEMPLATE_PREFIX)) {
      explicitTemplate = `${TEMPLATE_BASE}${normalizedTemplate}`
    } else {
      explicitTemplate = `${TEMPLATE_BASE}${TEMPLATE_PREFIX}${normalizedTemplate}`
    }
  } else {
    questions.push({
      type: 'select',
      name: 'template',
      message: 'Choose a template',
      choices: Object.keys(TEMPLATE_MAP),
      default: Template.Default,
      result: (value) => `${TEMPLATE_BASE}${TEMPLATE_MAP[value as Template]}`,
    })
  }

  const {template = explicitTemplate, ...promptOutput}: InitOptions = await prompt(questions)

  return {...options, ...promptOutput, template} as Required<InitOptions>
}

export default init
