import {appNamePrompt, createAsNewAppPrompt, selectAppPrompt} from '../../prompts/dev.js'
import {Organization, OrganizationApp} from '../../models/organization.js'
import {fetchAppFromApiKey, OrganizationAppsResponse} from '../dev/fetch.js'
import {CreateAppQuery, CreateAppQuerySchema} from '../../api/graphql/create_app.js'
import {AppInterface, Web, WebType} from '../../models/app/app.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputInfo} from '@shopify/cli-kit/node/output'

const MAGIC_URL = 'https://shopify.dev/magic-url'
const MAGIC_REDIRECT_URL = `${MAGIC_URL}/api/auth`
interface AppVars {
  org: number
  title: string
  type: string
  appUrl: string
  redir?: string[]
  requestedAccessScopes?: string[]
}

/**
 * Select an app from env, list or create a new one:
 * If there is no valid app yet, prompt the user to select one from the list or create a new one.
 * If no apps exists, we automatically prompt the user to create a new one.
 * @param app - Current local app information
 * @param apps - List of remote available apps
 * @param orgId - Current Organization
 * @returns The selected (or created) app
 */
export async function selectOrCreateApp(
  localApp: AppInterface,
  apps: OrganizationAppsResponse,
  org: Organization,
  token: string,
): Promise<OrganizationApp> {
  let createNewApp = apps.nodes.length === 0
  if (!createNewApp) {
    outputInfo(`\nBefore proceeding, your project needs to be associated with an app.\n`)
    createNewApp = await createAsNewAppPrompt()
  }
  if (createNewApp) {
    return createApp(org, localApp, token)
  } else {
    const selectedAppApiKey = await selectAppPrompt(apps, org.id, token)
    const fullSelectedApp = await fetchAppFromApiKey(selectedAppApiKey, token)
    return fullSelectedApp!
  }
}

const getAppVars = async (localApp: AppInterface, org: Organization) => {
  const name = await appNamePrompt(localApp.name)
  const frontendConfig = localApp.webs.find((web) => isWebType(web, WebType.Frontend))
  const backendConfig = localApp.webs.find((web) => isWebType(web, WebType.Backend))

  const variables: AppVars = {
    org: parseInt(org.id, 10),
    title: `${name}`,
    type: 'undecided',
    appUrl: '',
  }

  if (frontendConfig || backendConfig) {
    variables.appUrl = 'https://example.com'
    variables.redir = ['https://example.com/api/auth']
    if (localApp.configuration.scopes && localApp.configuration.scopes.length > 0) {
      variables.requestedAccessScopes = [localApp.configuration.scopes]
    }
  } else {
    variables.appUrl = MAGIC_URL
    variables.redir = [MAGIC_REDIRECT_URL]
    variables.requestedAccessScopes = []
  }

  return variables
}

export async function createApp(org: Organization, localApp: AppInterface, token: string): Promise<OrganizationApp> {
  const variables = await getAppVars(localApp, org)

  const query = CreateAppQuery
  const result: CreateAppQuerySchema = await partnersRequest(query, token, variables)
  if (result.appCreate.userErrors.length > 0) {
    const errors = result.appCreate.userErrors.map((error) => error.message).join(', ')
    throw new AbortError(errors)
  }

  const createdApp: OrganizationApp = result.appCreate.app
  createdApp.organizationId = org.id
  createdApp.newApp = true
  return createdApp
}

function isWebType(web: Web, type: WebType): boolean {
  return web.configuration.roles.includes(type)
}
