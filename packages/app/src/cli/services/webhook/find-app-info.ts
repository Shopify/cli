import {selectOrganizationPrompt, selectAppPrompt} from '../../prompts/dev.js'
import {fetchAppFromApiKey, fetchOrganizations, fetchOrgAndApps} from '../dev/fetch.js'
import {readAndParseDotEnv} from '@shopify/cli-kit/node/dot-env'
import {fileExists} from '@shopify/cli-kit/node/fs'
import {joinPath, basename} from '@shopify/cli-kit/node/path'

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

  const envFile = joinPath(process.cwd(), '.env')
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
export async function findApiKey(token: string): Promise<string | undefined> {
  const orgs = await fetchOrganizations(token)
  const org = await selectOrganizationPrompt(orgs)
  const {apps} = await fetchOrgAndApps(org.id, token)

  if (apps.length === 0) {
    return
  }

  // Try to infer from current folder
  const currentDir = basename(process.cwd())
  const appFromDir = apps.find((elm) => elm.title === currentDir)
  let apiKey
  if (appFromDir === undefined) {
    if (apps.length === 1 && apps[0]?.apiKey) {
      apiKey = apps[0].apiKey
    } else {
      apiKey = await selectAppPrompt(apps, org.id, token)
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
  const fullSelectedApp = await fetchAppFromApiKey(apiKey, token)
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
