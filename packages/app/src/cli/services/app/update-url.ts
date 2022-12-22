import {selectApp} from './select-app.js'
import {getURLs, PartnersURLs, updateURLs, validatePartnersURLs} from '../dev/urls.js'
import {allowedRedirectionURLsPrompt, appUrlPrompt} from '../../prompts/update-url.js'
import {output, session} from '@shopify/cli-kit'

export interface UpdateURLOptions {
  apiKey?: string
  appURL?: string
  redirectURLs?: string[]
}

export default async function updateURL(options: UpdateURLOptions): Promise<void> {
  const token = await session.ensureAuthenticatedPartners()
  const apiKey = options.apiKey || (await selectApp()).apiKey
  const newURLs = await getNewURLs(token, apiKey, {appURL: options.appURL, redirectURLs: options.redirectURLs})
  await updateURLs(newURLs, apiKey, token)
  printResult(newURLs)
}

async function getNewURLs(token: string, apiKey: string, options: UpdateURLOptions): Promise<PartnersURLs> {
  const currentURLs: PartnersURLs = await getURLs(apiKey, token)
  const newURLs: PartnersURLs = {
    applicationUrl: options.appURL || (await appUrlPrompt(currentURLs.applicationUrl)),
    redirectUrlWhitelist:
      options.redirectURLs || (await allowedRedirectionURLsPrompt(currentURLs.redirectUrlWhitelist.join(','))),
  }
  validatePartnersURLs(newURLs)
  return newURLs
}

function printResult(urls: PartnersURLs): void {
  output.success('App URLs updated')
  output.info(`\nApp URL:\n  ${urls.applicationUrl}`)
  output.info(`\nAllowed redirection URL(s):\n  ${urls.redirectUrlWhitelist.join('\n  ')}`)
}
