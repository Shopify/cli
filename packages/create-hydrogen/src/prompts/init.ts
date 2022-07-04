import {ui, github} from '@shopify/cli-kit'

const TEMPLATE_BASE = 'https://github.com/Shopify/hydrogen/templates/'
const BRANCH = `dist`
const TEMPLATE_NAME_DATA = {
  /* eslint-disable @typescript-eslint/naming-convention */
  'demo-store': {
    description: 'Demo Store',
  },
  'hello-world': {
    description: 'Hello World',
  },
}

const LANGUAGE_NAME_DATA = {
  js: {
    description: 'JavaScript',
  },
  ts: {
    description: 'TypeScript',
  },
}
/* eslint-enable @typescript-eslint/naming-convention */

const TEMPLATE_NAMES = Object.keys(TEMPLATE_NAME_DATA)
const LANGUAGE_NAMES = Object.keys(LANGUAGE_NAME_DATA)

interface InitOptions {
  name?: string
  template?: string
  language?: string
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

  if (!options.template) {
    questions.push({
      type: 'select',
      name: 'templateName',
      message: 'Choose a template',
      choices: Object.keys(TEMPLATE_NAME_DATA).map((value) => ({
        name: TEMPLATE_NAME_DATA[value as keyof typeof TEMPLATE_NAME_DATA].description,
        value,
      })),
      default: TEMPLATE_NAMES[0],
    })

    questions.push({
      type: 'select',
      name: 'language',
      message: 'Choose a language',
      choices: Object.keys(LANGUAGE_NAME_DATA).map((value) => ({
        name: LANGUAGE_NAME_DATA[value as keyof typeof LANGUAGE_NAME_DATA].description,
        value,
      })),
      default: LANGUAGE_NAMES[0],
    })
  }

  let {name, templateName, language} = await prompt(questions)
  if (options.name) name = options.name
  if (options.template) templateName = options.template
  if (options.language) language = options.language

  const parsedTemplate = github.parseRepoUrl(`${TEMPLATE_BASE}${templateName}-${language}#${BRANCH}`)
  const missingBranch = !parsedTemplate.ref
  const looksLikeHydrogenTemplate =
    parsedTemplate.name === 'hydrogen' &&
    parsedTemplate.user === 'Shopify' &&
    parsedTemplate.subDirectory.startsWith('templates/')
  const template = looksLikeHydrogenTemplate && missingBranch ? `${parsedTemplate.full}#${BRANCH}` : parsedTemplate.full

  return {name, template, language} as Required<InitOptions>
}

export default init
