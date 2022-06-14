import {ui, string} from '@shopify/cli-kit'

export enum Template {
  HelloWorld = 'Hello World',
  DemoStore = 'Demo Store',
  HelloWorldTypeScript = 'Hello World in TypeScript',
}

const TEMPLATE_BASE = 'https://github.com/Shopify/hydrogen/templates/'
const TEMPLATE_MAP = {
  [Template.DemoStore]: 'demo-store',
  [Template.HelloWorld]: 'hello-world-js',
  [Template.HelloWorldTypeScript]: 'hello-world-ts',
}

const BRANCH = `stackblitz`

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
    let normalizedTemplate = string.hyphenize(options.template)

    if (normalizedTemplate !== 'demo-store' && !normalizedTemplate.endsWith('-js')) {
      normalizedTemplate = `${normalizedTemplate}-js`
    }

    explicitTemplate = `${TEMPLATE_BASE}${normalizedTemplate}#${BRANCH}`
  } else {
    questions.push({
      type: 'select',
      name: 'template',
      message: 'Choose a template',
      choices: Object.keys(TEMPLATE_MAP),
      default: Template.DemoStore,
      result: (value) => `${TEMPLATE_BASE}${TEMPLATE_MAP[value as Template]}#${BRANCH}`,
    })
  }

  const {template = explicitTemplate, ...promptOutput}: InitOptions = await prompt(questions)

  return {...options, ...promptOutput, template} as Required<InitOptions>
}

export default init
