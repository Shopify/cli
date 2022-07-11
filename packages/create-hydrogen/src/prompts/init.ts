import {ui, github, string, output} from '@shopify/cli-kit'

const TEMPLATE_BASE = 'https://github.com/Shopify/hydrogen/templates/'
const BRANCH = `dist`
const TEMPLATE_DATA = {
  /* eslint-disable @typescript-eslint/naming-convention */
  'demo-store-js': {
    description: 'Demo Store',
  },
  'demo-store-ts': {
    description: 'Demo Store (TypeScript)',
  },
  'hello-world-js': {
    description: 'Hello World',
  },
  'hello-world-ts': {
    description: 'Hello World (TypeScript)',
  },
  /* eslint-enable @typescript-eslint/naming-convention */
}

const TEMPLATE_NAMES = Object.keys(TEMPLATE_DATA)

function toHydrogenTemplateName(key: string) {
  const normalized = string.hyphenize(key).toLocaleLowerCase()
  const withExtension = normalized.endsWith('-ts') || normalized.endsWith('-js') ? normalized : `${normalized}-js`

  return TEMPLATE_NAMES.includes(withExtension) ? withExtension : false
}

function toHydrogenTemplateUrl(key: string) {
  return `${TEMPLATE_BASE}${key}#${BRANCH}`
}

interface InitOptions {
  name?: string
  template?: string
}

const init = async (options: InitOptions, prompt = ui.prompt): Promise<Required<InitOptions>> => {
  output.debug(output.content`create-hydrogen prompts for init with options: ${output.token.json(options)}`)

  const questions: ui.Question[] = []
  if (!options.name) {
    questions.push({
      type: 'input',
      name: 'name',
      message: 'Name your new Hydrogen storefront',
      default: 'hydrogen-app',
    })
  }

  let explicitTemplate = options.template

  if (explicitTemplate) {
    const hydrogenTemplate = toHydrogenTemplateName(explicitTemplate)

    if (hydrogenTemplate) {
      const url = toHydrogenTemplateUrl(hydrogenTemplate)
      explicitTemplate = url
    }

    const parsedTemplate = github.parseRepoUrl(explicitTemplate)
    const missingBranch = !parsedTemplate.ref
    const looksLikeHydrogenTemplate =
      parsedTemplate.name === 'hydrogen' &&
      parsedTemplate.user === 'Shopify' &&
      parsedTemplate.subDirectory.startsWith('templates/')

    explicitTemplate =
      looksLikeHydrogenTemplate && missingBranch ? `${parsedTemplate.full}#${BRANCH}` : parsedTemplate.full
  } else {
    questions.push({
      type: 'select',
      name: 'template',
      message: 'Choose a template',
      choices: Object.keys(TEMPLATE_DATA).map((value) => ({
        name: TEMPLATE_DATA[value as keyof typeof TEMPLATE_DATA].description,
        value,
      })),
      default: TEMPLATE_NAMES[0],
      result: toHydrogenTemplateUrl,
    })
  }

  const {template = explicitTemplate, ...promptOutput}: InitOptions = await prompt(questions)
  const result = {...options, ...promptOutput, template}

  output.debug(output.content`create-hydrogen prompts completed with ${output.token.json(result)}`)

  return result as Required<InitOptions>
}

export default init
