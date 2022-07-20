import {ui, github, string, output} from '@shopify/cli-kit'

const TEMPLATE_BASE = 'https://github.com/Shopify/hydrogen/templates/'
const BRANCH = `dist`
const TEMPLATE_NAME_DATA = {
  /* eslint-disable @typescript-eslint/naming-convention */
  'demo-store': {
    name: 'Demo Store',
    description: 'A simple store with a demo storefront',
  },
  'hello-world': {
    name: 'Hello World',
    description: 'A simple store with a hello world storefront',
  },
}

const LANGUAGE_NAME_DATA = {
  js: {
    name: 'JavaScript',
    description: 'This is the default language, regular old JavaScript',
  },
  ts: {
    name: 'TypeScript',
    description: 'A typed superset of JavaScript created by Microsoft',
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

  // Given template // no language -> create-hydrogen --template <name> // default to javascript
  // Given template // language ->  create-hydrogen --template <name> --ts //
  // Given no template // language -> create-hydrogen --ts // ask for template
  // Given no t // no l -> ask everything
  // Given URL template // language -> create github/blah --ts

  // Check if is our template
  // demo-store or hello-world
  let explicitTemplate = options.template
  let isGithubUrl
  if (explicitTemplate) {
    // Get our template URLS
    const hydrogenTemplate =
      checkIfShopifyTemplate(explicitTemplate, 'js') || checkIfShopifyTemplate(explicitTemplate, 'ts')

    isGithubUrl = Boolean(hydrogenTemplate)

    if (hydrogenTemplate) {
      const url = toHydrogenTemplateUrl(hydrogenTemplate as string)
      explicitTemplate = url
    }

    // else it is a URL provided by the user
    const parsedTemplate = github.parseRepoUrl(explicitTemplate)

    // add magic to specific branch
    const missingBranch = !parsedTemplate.ref
    const looksLikeHydrogenTemplate =
      parsedTemplate.name === 'hydrogen' &&
      parsedTemplate.user === 'Shopify' &&
      parsedTemplate.subDirectory.startsWith('templates/')

    explicitTemplate =
      looksLikeHydrogenTemplate && missingBranch ? `${parsedTemplate.full}#${BRANCH}` : parsedTemplate.full
  }

  if (!options.template) {
    questions.push({
      type: 'select',
      name: 'templateName',
      message: 'Choose a template',
      choices: Object.keys(TEMPLATE_NAME_DATA).map((value) => ({
        name: TEMPLATE_NAME_DATA[value as keyof typeof TEMPLATE_NAME_DATA].name,
        value,
      })),
      default: TEMPLATE_NAMES[0],
    })
  }

  if (!options.language && isGithubUrl) {
    questions.push({
      type: 'select',
      name: 'language',
      message: 'Choose a language',
      choices: Object.keys(LANGUAGE_NAME_DATA).map((value) => {
        const {name, description} = LANGUAGE_NAME_DATA[value as keyof typeof LANGUAGE_NAME_DATA]
        return {name: `${name} - ${description}`, value}
      }),
      default: LANGUAGE_NAMES[0],
    })
  }

  const promptResults = await prompt(questions)
  const name = options.name ?? promptResults.name
  const templateName = options.template ?? promptResults.templateName
  const language = options.language ?? promptResults.language

  explicitTemplate = templateName

  // Get final template URLS
  const hydrogenTemplate = checkIfShopifyTemplate(templateName, language)

  if (hydrogenTemplate) {
    const url = toHydrogenTemplateUrl(hydrogenTemplate as string)
    explicitTemplate = url
  }

  // else it is a URL provided by the user
  const parsedTemplate = github.parseRepoUrl(explicitTemplate)

  const missingBranch = !parsedTemplate.ref
  const looksLikeHydrogenTemplate =
    parsedTemplate.name === 'hydrogen' &&
    parsedTemplate.user === 'Shopify' &&
    parsedTemplate.subDirectory.startsWith('templates/')
  const template = looksLikeHydrogenTemplate && missingBranch ? `${parsedTemplate.full}#${BRANCH}` : parsedTemplate.full
  output.info(template)
  return {name, template, language} as Required<InitOptions>
}

function toHydrogenTemplateUrl(key: string) {
  return `${TEMPLATE_BASE}${key}#${BRANCH}`
}

/**
 * Checks if the provided name is a Shopify template, or if it is a custom URL to a user-provided template.
 *
 * @param templateName The name of the template to check.
 * @param language The language of the template, only provided if the template is a Shopify template.
 * @returns The fully formed template URL if is a Shopfiy template, false otherwise.
 */
const checkIfShopifyTemplate = (templateName: string, language: string): string | boolean => {
  const normalized = string.hyphenize(templateName).toLocaleLowerCase()
  const withExtension =
    normalized.endsWith('-ts') || normalized.endsWith('-js') ? normalized : `${normalized}-${language}`

  return TEMPLATE_NAMES.includes(normalized) ? withExtension : false
}

export default init
