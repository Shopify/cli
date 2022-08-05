import {ui, github, string, output} from '@shopify/cli-kit'

const TEMPLATE_BASE = 'https://github.com/Shopify/hydrogen/templates/'
const BRANCH = `dist`

const TEMPLATE_NAME_DATA = {
  'demo-store': {name: 'Demo Store'},
  'hello-world': {name: 'Hello World'},
}

const LANGUAGE_NAME_DATA = {
  js: {name: 'JavaScript'},
  ts: {name: 'TypeScript'},
}

const TEMPLATE_NAMES = Object.keys(TEMPLATE_NAME_DATA)
const LANGUAGE_NAMES = Object.keys(LANGUAGE_NAME_DATA)

interface InitOptions {
  name?: string
  template?: string
  language?: string
}

const init = async (options: InitOptions, prompt = ui.prompt): Promise<Required<InitOptions>> => {
  const questions: ui.Question[] = []
  const explicitTemplate = options.template
  let isAShopifyTemplateName = false
  // If the template is passed through the CLI, then it can either be a Shopify template name (hello-world or demo-store)
  // or a custom URL to any template.
  if (explicitTemplate) {
    warnIfDeprecatedTemplateNameFormat(explicitTemplate)
    const hydrogenTemplate =
      checkIfShopifyTemplateName(explicitTemplate, 'js') || checkIfShopifyTemplateName(explicitTemplate, 'ts')
    isAShopifyTemplateName = Boolean(hydrogenTemplate)
  } else {
    isAShopifyTemplateName = true
    questions.push({
      type: 'select',
      name: 'template',
      message: 'Choose a template',
      choices: Object.keys(TEMPLATE_NAME_DATA).map((value) => ({
        name: TEMPLATE_NAME_DATA[value as keyof typeof TEMPLATE_NAME_DATA].name,
        value,
      })),
      default: TEMPLATE_NAMES[0],
    })
  }

  // Prompt the user for the template language if it isn't provided and
  // the given template is a URL.
  if (!options.language && isAShopifyTemplateName) {
    questions.push({
      type: 'select',
      name: 'language',
      message: 'Choose a language',
      choices: Object.keys(LANGUAGE_NAME_DATA).map((value) => {
        const {name} = LANGUAGE_NAME_DATA[value as keyof typeof LANGUAGE_NAME_DATA]
        return {name, value}
      }),
      default: LANGUAGE_NAMES[0],
    })
  }

  if (!options.name) {
    questions.push({
      type: 'input',
      name: 'name',
      message: 'Name your new Hydrogen storefront',
      default: 'hydrogen-app',
    })
  }

  const promptResults = await prompt(questions)
  const name = options.name ?? promptResults.name
  const templateName = options.template ?? promptResults.template
  const language = options.language ?? promptResults.language
  let template = templateName

  // Get final template URLS
  const hydrogenTemplate = checkIfShopifyTemplateName(templateName, language)
  if (hydrogenTemplate) template = convertTemplateNameToUrl(hydrogenTemplate as string)

  // Else it's a user-provided URL.
  template = parseTemplateUrl(template)
  return {name, template, language} as Required<InitOptions>
}

/**
 * Checks if the provided name is a Shopify template, or if it's a custom URL to a user-provided template.
 *
 * @param templateName: The name of the template to check.
 * @param language: The language of the template, only provided if the template is a Shopify template
 * @returns: The fully-formed template name (with the language suffixed) if it's a Shopify template, false otherwise.
 */
const checkIfShopifyTemplateName = (templateName: string, language: string): string | boolean => {
  if (!templateName) return false

  const normalized = string.hyphenize(templateName).toLocaleLowerCase()
  const endsWithLang = normalized.endsWith('-ts') || normalized.endsWith('-js')
  const withExtension = endsWithLang ? normalized : `${normalized}-${language}`
  return TEMPLATE_NAMES.includes(normalized) ? withExtension : false
}

/**
 * Lets the user know if they're trying to use a template in the old naming format.
 *
 * @param templateName: The name of the template to check.
 * @returns: True if the template name is in the old format, false otherwise.
 */
const warnIfDeprecatedTemplateNameFormat = (templateName: string): void => {
  const normalized = string.hyphenize(templateName).toLocaleLowerCase()
  const endsWithLang = normalized.endsWith('-ts') || normalized.endsWith('-js')
  if (endsWithLang) {
    const template = normalized.slice(0, -3)
    const lang = normalized.slice(-2)
    const ts = lang === 'ts'
    output.warn(
      `The ${normalized} template has been deprecated. Use --template ${template} ${
        ts ? `--${lang} ` : ''
      }to install the ${ts ? 'TypeScript' : 'JavaScript'} template.`,
    )
  }
}

/**
 * Takes the name of a Shopify template (for example, demo-store or hello-world) and converts it to a URL.
 *
 * @param templateName: The given name of a Shopify template.
 * @returns: The URL of the template.
 */
const convertTemplateNameToUrl = (templateName: string): string => `${TEMPLATE_BASE}${templateName}#${BRANCH}`

/**
 * Checks to see if the provided URL can be parsed by Github. For Shopify-specific templates, adds any
 * missing information (for example, a missing branch) to the repo information in the URL.
 *
 * @param templateUrl: The URL of the template to parse.
 * @returns: The parsed URL.
 */
const parseTemplateUrl = (templateUrl: string): string => {
  const parsedTemplate = github.parseRepoUrl(templateUrl)
  const missingBranch = !parsedTemplate.ref
  const looksLikeHydrogenTemplate =
    parsedTemplate.name === 'hydrogen' &&
    parsedTemplate.user === 'Shopify' &&
    parsedTemplate.subDirectory.startsWith('templates/')

  return looksLikeHydrogenTemplate && missingBranch ? `${parsedTemplate.full}#${BRANCH}` : parsedTemplate.full
}

export default init
