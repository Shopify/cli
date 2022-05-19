import {ui} from '@shopify/cli-kit'

export enum Template {
  Minimum = 'Hello world',
  Default = 'Demo store',
}

const TEMPLATE_BASE = 'Shopify/hydrogen/templates/template-hydrogen-'

const TEMPLATE_MAP = {
  [Template.Default]: 'default',
  [Template.Minimum]: 'hello-world',
}

interface InitOptions {
  name?: string
  template?: string
}

interface InitOutput {
  name: string
  template: Template
}

const init = async (options: InitOptions, prompt = ui.prompt): Promise<InitOutput> => {
  const questions: ui.Question[] = []
  if (!options.name) {
    questions.push({
      type: 'input',
      name: 'name',
      message: 'Name your new Hydrogen storefront',
      default: 'hydrogen-app',
    })
  }

  if (!options.template) {
    questions.push({
      type: 'select',
      name: 'template',
      message: 'Choose a template',
      choices: Object.keys(TEMPLATE_MAP),
      default: Template.Default,
      result: (value) => `${TEMPLATE_BASE}${TEMPLATE_MAP[value as Template]}`,
    })
  }

  const promptOutput: InitOutput = await prompt(questions)
  return {...options, ...promptOutput}
}

export default init
