import {ui} from '@shopify/cli-kit'

export enum Template {
  Minimum = 'template-hydrogen-minimum',
  Default = 'template-hydrogen-default',
}

interface InitOptions {
  name?: string
  template?: string
}

interface InitOutput {
  name: string
  template: Template
}

const TEMPLATE_MAP = {
  [Template.Default]: 'Shopify/hydrogen/templates/template-hydrogen-default',
  [Template.Minimum]: 'Shopify/hydrogen/templates/template-hydrogen-hello-world',
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
      result: (value) => TEMPLATE_MAP[value as Template],
    })
  }

  const promptOutput: InitOutput = await prompt(questions)
  return {...options, ...promptOutput}
}

export default init
