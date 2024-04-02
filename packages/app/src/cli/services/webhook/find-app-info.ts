import {selectOrganizationPrompt, selectAppPrompt} from '../../prompts/dev.js'
import {fetchOrganizations, fetchOrgAndApps} from '../dev/fetch.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {MinimalAppIdentifiers} from '../../models/organization.js'
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
 * @param developerPlatformClient - The client to access the platform API
 * @returns appIdentifiers
 */
export async function findOrganizationApp(
  developerPlatformClient: DeveloperPlatformClient,
): Promise<Partial<MinimalAppIdentifiers> & {organizationId: MinimalAppIdentifiers['organizationId']}> {
  const orgs = await fetchOrganizations(developerPlatformClient)
  const org = await selectOrganizationPrompt(orgs)
  const partnersSession = await developerPlatformClient.session()
  const {apps} = await fetchOrgAndApps(org.id, partnersSession)

  if (apps.nodes.length === 0) {
    return {organizationId: org.id}
  }

  // Try to infer from current folder
  const currentDir = basename(cwd())
  const appFromDir = apps.nodes.find((elm) => elm.title === currentDir)
  if (appFromDir === undefined) {
    if (apps.nodes.length === 1 && apps.nodes[0]?.apiKey) {
      const apiKey = apps.nodes[0].apiKey
      return {id: apiKey, apiKey, organizationId: org.id}
    } else {
      return selectAppPrompt(apps.nodes, apps.pageInfo.hasNextPage, org.id)
    }
  } else {
    const apiKey = appFromDir.apiKey
    return {id: apiKey, apiKey, organizationId: org.id}
  }
}

/**
 * Find the app api_key, if available
 *
 * @param developerPlatformClient - The client to access the platform API
 * @param apiKey - app api_key
 * @returns client_id, client_secret, client_api_key
 */
export async function requestAppInfo(
  {id, apiKey, organizationId}: MinimalAppIdentifiers,
  developerPlatformClient: DeveloperPlatformClient,
): Promise<AppCredentials> {
  const fullSelectedApp = await developerPlatformClient.appFromId({id, apiKey, organizationId})
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
