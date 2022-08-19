import {ui, file} from '@shopify/cli-kit'

interface InitOptions {
  directory: string
  country: string
  lang: string
  domain: string
  token: string
  apiVersion: string
}

export async function init(options: InitOptions, prompt = ui.prompt): Promise<void> {
  const questions: ui.Question[] = []
  if (!options.country)
    questions.push({
      type: 'input',
      name: 'country',
      message: 'The default country code for your store.',
      default: 'US',
    })

  if (!options.lang)
    questions.push({
      type: 'input',
      name: 'lang',
      message: 'The default language code for your store.',
      default: 'EN',
    })

  if (!options.domain)
    questions.push({
      type: 'input',
      name: 'domain',
      message: 'The Shopify storefront domain.',
      default: 'hydrogen-preview.myshopify.com',
    })

  if (!options.token)
    questions.push({
      type: 'input',
      name: 'token',
      message: 'The Shopify storefront token.',
      default: '3b580e70970c4528da70c98e097c2fa0',
    })

  if (!options.apiVersion)
    questions.push({
      type: 'input',
      name: 'apiVersion',
      message: 'The Shopify storefront API version.',
      default: '2022-07',
    })

  const promptResults = await prompt(questions)
  const country = options.country || promptResults.country
  const lang = options.lang || promptResults.lang
  const domain = options.domain || promptResults.domain
  const token = options.token || promptResults.token
  const apiVersion = options.apiVersion || promptResults.apiVersion

  await file.write('hydrogen.config.js', JSON.stringify(options, null, 2))
}
