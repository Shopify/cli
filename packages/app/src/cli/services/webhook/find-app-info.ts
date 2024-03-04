import {selectOrganizationPrompt, selectAppPrompt} from '../../prompts/dev.js'
import {fetchAppDetailsFromApiKey, fetchOrganizations, fetchOrgAndApps} from '../dev/fetch.js'
import {PartnersSession} from '../context/partner-account-info.js'
import {readAndParseDotEnv} from '@shopify/cli-kit/node/dot-env'
import {fileExists} from '@shopify/cli-kit/node/fs'
import {joinPath, basename, cwd} from '@shopify/cli-kit/node/path'

export interface AppCredentials {
  clientSecret?: string
  apiKey?: string
  clientId?: string
}

/**
 * Grabs secret and api_key from .env file if existing
 *
 * @returns secret and api_key
 */
export async function findInEnv(): Promise<AppCredentials> {
  const credentials: AppCredentials = {}

  const envFile = joinPath(cwd(), '.env')
  if (await fileExists(envFile)) {
    const dotenv = await readAndParseDotEnv(envFile)

    credentials.clientSecret = dotenv.variables.SHOPIFY_API_SECRET
    credentials.apiKey = dotenv.variables.SHOPIFY_API_KEY
  }

  return credentials
}

/**
 * Find the app api_key, if available
 *
 * @param token - partners token
 * @returns apiKey
 */
export async function findApiKey(partnersSession: PartnersSession): Promise<string | undefined> {
  const orgs = await fetchOrganizations(partnersSession)
  const org = await selectOrganizationPrompt(orgs)
  const {apps} = await fetchOrgAndApps(org.id, partnersSession)

  if (apps.nodes.length === 0) {
    return
  }

  // Try to infer from current folder
  const currentDir = basename(cwd())
  const appFromDir = apps.nodes.find((elm) => elm.title === currentDir)
  let apiKey
  if (appFromDir === undefined) {
    if (apps.nodes.length === 1 && apps.nodes[0]?.apiKey) {
      apiKey = apps.nodes[0].apiKey
    } else {
      apiKey = await selectAppPrompt(apps.nodes, apps.pageInfo.hasNextPage, org.id)
    }
  } else {
    apiKey = appFromDir.apiKey
  }

  return apiKey
}

/**
 * Find the app api_key, if available
 *
 * @param token - partners token
 * @param apiKey - app api_key
 * @returns client_id, client_secret, client_api_key
 */
export async function requestAppInfo(token: string, apiKey: string): Promise<AppCredentials> {
  const fullSelectedApp = await fetchAppDetailsFromApiKey(apiKey, token)
  const credentials: AppCredentials = {}
  if (fullSelectedApp === undefined) {
    return credentials
  }
  credentials.apiKey = apiKey
  credentials.clientId = fullSelectedApp.id

  const entry = fullSelectedApp.apiSecretKeys.find((elm) => elm.secret)
  if (entry) {
    credentials.clientSecret = entry.secret
  }

  return credentials
}
