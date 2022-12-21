import {selectApp} from './select-app.js'
import {getURLs, PartnersURLs, updateURLs, validateParntersURLs} from '../dev/urls.js'
import {allowedRedirectionURLsPrompt, appUrlPrompt} from '../../prompts/update-url.js'
import {output, session} from '@shopify/cli-kit'

export default async function updateURL(
  flagApiKey: string | undefined,
  flagAppURL: string | undefined,
  flagRedirectURLs: string[] | undefined,
): Promise<void> {
  const token = await session.ensureAuthenticatedPartners()
  const apiKey = flagApiKey || (await selectApp()).apiKey
  const newURLs = await getNewURLs(apiKey, token, flagAppURL, flagRedirectURLs)
  await updateURLs(newURLs, apiKey, token)
  printResult(newURLs)
}

async function getNewURLs(
  apiKey: string,
  token: string,
  flagAppURL: string | undefined,
  flagRedirectURLs: string[] | undefined,
): Promise<PartnersURLs> {
  const currentURLs: PartnersURLs = await getURLs(apiKey, token)
  const newURLs: PartnersURLs = {
    applicationUrl: flagAppURL || (await appUrlPrompt(currentURLs.applicationUrl)),
    redirectUrlWhitelist:
      flagRedirectURLs || (await allowedRedirectionURLsPrompt(currentURLs.redirectUrlWhitelist.join(','))),
  }
  validateParntersURLs(newURLs)
  return newURLs
}

function printResult(urls: PartnersURLs): void {
  output.success('App URLs updated')
  output.info(`\nApp URL:\n  ${urls.applicationUrl}`)
  output.info(`\nAllowed redirection URL(s):\n  ${urls.redirectUrlWhitelist.join('\n  ')}`)
}
