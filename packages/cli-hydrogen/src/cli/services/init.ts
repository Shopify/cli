import {ui, file} from '@shopify/cli-kit'

const configFileTemplate = `
import {defineConfig} from '@shopify/hydrogen/config';

export default defineConfig({
  shopify: CONFIG,
});`

interface InitOptions {
  directory: string
  domain: string
  token: string
  apiVersion: string
}

export async function init(options: InitOptions, prompt = ui.prompt): Promise<void> {
  const questions: ui.Question[] = []
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

  const promptResults = await prompt(questions)
  const config = {
    domain: options.domain || promptResults.domain,
    token: options.token || promptResults.token,
    apiVersion: options.apiVersion || promptResults.apiVersion,
  }

  await file.write('hydrogen.config.js', configFileTemplate.replace('CONFIG', JSON.stringify(config, null, 2)))
}
