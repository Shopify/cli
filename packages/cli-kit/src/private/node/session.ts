import {applicationId} from './session/identity.js'
import {validateSession} from './session/validate.js'
import {allDefaultScopes, apiScopes} from './session/scopes.js'
import {
  exchangeAccessForApplicationTokens,
  exchangeCustomPartnerToken,
  ExchangeScopes,
  refreshAccessToken,
  InvalidGrantError,
  InvalidRequestError,
} from './session/exchange.js'
import {IdentityToken, Session, Sessions} from './session/schema.js'
import * as sessionStore from './session/store.js'
import {isThemeAccessSession} from './api/rest.js'
import {getCurrentSessionId, setCurrentSessionId} from './conf-store.js'
import {outputContent, outputToken, outputDebug, outputCompleted} from '../../public/node/output.js'
import {firstPartyDev, themeToken} from '../../public/node/context/local.js'
import {AbortError} from '../../public/node/error.js'
import {normalizeStoreFqdn, identityFqdn} from '../../public/node/context/fqdn.js'
import {getIdentityTokenInformation, getPartnersToken} from '../../public/node/environment.js'
import {AdminSession, logout} from '../../public/node/session.js'
import {nonRandomUUID} from '../../public/node/crypto.js'
import {isEmpty} from '../../public/common/object.js'
import {businessPlatformRequest, fetchEmail} from '../../public/node/api/business-platform.js'

import {getIdentityClient} from '../../public/node/api/identity-client.js'

/**
 * Fetches the user's email from the Business Platform API
 * @param businessPlatformToken - The business platform token
 * @returns The user's email address or undefined if not found
 */
async function fetchEmail(businessPlatformToken: string | undefined): Promise<string | undefined> {
  if (!businessPlatformToken) return undefined

  try {
    const userEmailResult = await businessPlatformRequest<UserEmailQuery>(UserEmailQueryString, businessPlatformToken)
    return userEmailResult.currentUserAccount?.email
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    outputDebug(outputContent`Failed to fetch user email: ${(error as Error).message ?? String(error)}`)
    return undefined
  }
}

/**
 * A scope supported by the Shopify Admin API.
 */
export type AdminAPIScope = 'graphql' | 'themes' | 'collaborator'

/**
 * It represents the options to authenticate against the Shopify Admin API.
 */

interface AdminAPIOAuthOptions {
  /** Store to request permissions for. */
  storeFqdn: string
  /** List of scopes to request permissions for. */
  scopes: AdminAPIScope[]
}

/**
 * A scope supported by the Partners API.
 */
export type PartnersAPIScope = 'cli'
interface PartnersAPIOAuthOptions {
  /** List of scopes to request permissions for. */
  scopes: PartnersAPIScope[]
}

/**
 * A scope supported by the Developer Platform API.
 */
export type AppManagementAPIScope = 'https://api.shopify.com/auth/organization.apps.manage'
interface AppManagementAPIOauthOptions {
  /** List of scopes to request permissions for. */
  scopes: AppManagementAPIScope[]
}

/**
 * A scope supported by the Storefront Renderer API.
 */
export type StorefrontRendererScope = 'devtools'
interface StorefrontRendererAPIOAuthOptions {
  /** List of scopes to request permissions for. */
  scopes: StorefrontRendererScope[]
}

export type BusinessPlatformScope = 'destinations'
interface BusinessPlatformAPIOAuthOptions {
  /** List of scopes to request permissions for. */
  scopes: BusinessPlatformScope[]
}

/**
 * It represents the authentication requirements and
 * is the input necessary to trigger the authentication
 * flow.
 */
export interface OAuthApplications {
  adminApi?: AdminAPIOAuthOptions
  storefrontRendererApi?: StorefrontRendererAPIOAuthOptions
  partnersApi?: PartnersAPIOAuthOptions
  businessPlatformApi?: BusinessPlatformAPIOAuthOptions
  appManagementApi?: AppManagementAPIOauthOptions
}

export interface OAuthSession {
  admin?: AdminSession
  partners?: string
  storefront?: string
  businessPlatform?: string
  appManagement?: string
  userId: string
}

type AuthMethod = 'partners_token' | 'device_auth' | 'theme_access_token' | 'custom_app_token' | 'none'

let userId: undefined | string
let authMethod: AuthMethod = 'none'

/**
 * Retrieves the user ID from the current session or returns 'unknown' if not found.
 *
 * This function performs the following steps:
 * 1. Checks for a cached user ID in memory (obtained in the current run).
 * 2. Attempts to fetch it from the local storage (from a previous auth session).
 * 3. Checks if a custom token was used (either as a theme password or partners token).
 * 4. If a custom token is present in the environment, generates a UUID and uses it as userId.
 * 5. If after all this we don't have a userId, then reports as 'unknown'.
 *
 * @returns A Promise that resolves to the user ID as a string.
 */
export async function getLastSeenUserIdAfterAuth(): Promise<string> {
  if (userId) return userId

  const currentSessionId = getCurrentSessionId()
  if (currentSessionId) return currentSessionId

  const customToken = getPartnersToken() ?? themeToken()
  return customToken ? nonRandomUUID(customToken) : 'unknown'
}

export function setLastSeenUserIdAfterAuth(id: string) {
  userId = id
}

/**
 * Retrieves the last seen authentication method used in the current session.
 *
 * This function checks for the authentication method in the following order:
 * 1. Returns the cached auth method if it's not 'none'.
 * 2. Checks for a cached session, which implies 'device_auth' was used.
 * 3. Checks for a partners token in the environment.
 * 4. Checks for a theme password in the environment.
 * 5. If none of the above are true, returns 'none'.
 *
 * @returns A Promise that resolves to the last seen authentication method as an AuthMethod type.
 */
export async function getLastSeenAuthMethod(): Promise<AuthMethod> {
  if (authMethod !== 'none') return authMethod

  if (getCurrentSessionId()) return 'device_auth'

  const partnersToken = getPartnersToken()
  if (partnersToken) return 'partners_token'

  const themePassword = themeToken()
  if (themePassword) {
    return isThemeAccessSession({token: themePassword, storeFqdn: ''}) ? 'theme_access_token' : 'custom_app_token'
  }

  return 'none'
}

export function setLastSeenAuthMethod(method: AuthMethod) {
  authMethod = method
}

export interface EnsureAuthenticatedAdditionalOptions {
  noPrompt?: boolean
  forceRefresh?: boolean
  forceNewSession?: boolean
}

/**
 * This method ensures that we have a valid session to authenticate against the given applications using the provided scopes.
 *
 * @param applications - An object containing the applications we need to be authenticated with.
 * @param _env - Optional environment variables to use.
 * @param options - Optional extra options to use.
 * @returns An instance with the access tokens organized by application.
 */
export async function ensureAuthenticated(
  applications: OAuthApplications,
  _env?: NodeJS.ProcessEnv,
  {forceRefresh = false, noPrompt = false, forceNewSession = false}: EnsureAuthenticatedAdditionalOptions = {},
): Promise<OAuthSession> {
  const fqdn = await identityFqdn()

  const previousStoreFqdn = applications.adminApi?.storeFqdn
  if (previousStoreFqdn) {
    const normalizedStoreName = normalizeStoreFqdn(previousStoreFqdn)
    if (previousStoreFqdn === applications.adminApi?.storeFqdn) {
      applications.adminApi.storeFqdn = normalizedStoreName
    }
  }

  const sessions = (await sessionStore.fetch()) ?? {}

  let currentSessionId = getCurrentSessionId()
  if (!currentSessionId) {
    const userIds = Object.keys(sessions[fqdn] ?? {})
    if (userIds.length > 0) currentSessionId = userIds[0]
  }
  const currentSession: Session | undefined =
    currentSessionId && !forceNewSession ? sessions[fqdn]?.[currentSessionId] : undefined
  const scopes = getFlattenScopes(applications)

  outputDebug(outputContent`Validating existing session against the scopes:
${outputToken.json(scopes)}
For applications:
${outputToken.json(applications)}
`)

  const validationResult = await validateSession(scopes, applications, currentSession)

  let newSession = {}

  if (validationResult === 'needs_full_auth') {
    await throwOnNoPrompt(noPrompt)
    outputDebug(outputContent`Initiating the full authentication flow...`)
    newSession = await executeCompleteFlow(applications)
  } else if (validationResult === 'needs_refresh' || forceRefresh) {
    outputDebug(outputContent`The current session is valid but needs refresh. Refreshing...`)
    try {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      newSession = await refreshTokens(currentSession!, applications)
    } catch (error) {
      if (error instanceof InvalidGrantError) {
        await throwOnNoPrompt(noPrompt)
        newSession = await executeCompleteFlow(applications)
      } else if (error instanceof InvalidRequestError) {
        await sessionStore.remove()
        throw new AbortError('\nError validating auth session', "We've cleared the current session, please try again")
      } else {
        throw error
      }
    }
  }

  const completeSession = {...currentSession, ...newSession} as Session
  const newSessionId = completeSession.identity.userId
  const updatedSessions: Sessions = {
    ...sessions,
    [fqdn]: {...sessions[fqdn], [newSessionId]: completeSession},
  }

  // Save the new session info if it has changed
  if (!isEmpty(newSession)) {
    await sessionStore.store(updatedSessions)
    setCurrentSessionId(newSessionId)
  }

  const tokens = await tokensFor(applications, completeSession)

  // Overwrite partners token if using a custom CLI Token
  const envToken = getPartnersToken()
  if (envToken && applications.partnersApi) {
    tokens.partners = (await exchangeCustomPartnerToken(envToken)).accessToken
  }

  setLastSeenAuthMethod(envToken ? 'partners_token' : 'device_auth')
  setLastSeenUserIdAfterAuth(tokens.userId)
  return tokens
}

async function throwOnNoPrompt(noPrompt: boolean) {
  if (!noPrompt) return
  await logout()
  throw new AbortError(
    `The currently available CLI credentials are invalid.

The CLI is currently unable to prompt for reauthentication.`,
    'Restart the CLI process you were running. If in an interactive terminal, you will be prompted to reauthenticate. If in a non-interactive terminal, ensure the correct credentials are available in the program environment.',
  )
}

/**
 * Execute the full authentication flow.
 *
 * @param applications - An object containing the applications we need to be authenticated with.
 * @param alias - Optional alias to use for the session.
 */
async function executeCompleteFlow(applications: OAuthApplications): Promise<Session> {
  const scopes = getFlattenScopes(applications)
  const exchangeScopes = getExchangeScopes(applications)
  const store = applications.adminApi?.storeFqdn
  if (firstPartyDev()) {
    outputDebug(outputContent`Authenticating as Shopify Employee...`)
    scopes.push('employee')
  }

  let identityToken: IdentityToken
  const identityTokenInformation = getIdentityTokenInformation()
  if (identityTokenInformation) {
    identityToken = buildIdentityTokenFromEnv(scopes, identityTokenInformation)
  } else {
    // Request a device code to authorize without a browser redirect.
    outputDebug(outputContent`Requesting device authorization code...`)
    const client = getIdentityClient()
    const deviceAuth = await client.requestDeviceAuthorization(scopes)

    // Poll for the identity token
    outputDebug(outputContent`Starting polling for the identity token...`)
    identityToken = await client.pollForDeviceAuthorization(deviceAuth)
  }

  // Exchange identity token for application tokens
  outputDebug(outputContent`CLI token received. Exchanging it for application tokens...`)
  const result = await exchangeAccessForApplicationTokens(identityToken, exchangeScopes, store)

  // Get the alias for the session (email or userId)
  const businessPlatformToken = result[applicationId('business-platform')]?.accessToken
  const alias = (await fetchEmail(businessPlatformToken)) ?? identityToken.userId

  const session: Session = {
    identity: {
      ...identityToken,
      alias,
    },
    applications: result,
  }

  outputCompleted(`Logged in.`)

  return session
}

/**
 * Refresh the tokens for a given session.
 *
 * @param session - The session to refresh.
 */
async function refreshTokens(session: Session, applications: OAuthApplications): Promise<Session> {
  // Refresh Identity Token
  const identityToken = await refreshAccessToken(session.identity)
  // Exchange new identity token for application tokens
  const exchangeScopes = getExchangeScopes(applications)
  const applicationTokens = await exchangeAccessForApplicationTokens(
    identityToken,
    exchangeScopes,
    applications.adminApi?.storeFqdn,
  )

  return {
    identity: identityToken,
    applications: applicationTokens,
  }
}

/**
 * Get the application tokens for a given session.
 *
 * @param applications - An object containing the applications we need the tokens for.
 * @param session - The current session.
 * @param fqdn - The identity FQDN.
 */
async function tokensFor(applications: OAuthApplications, session: Session): Promise<OAuthSession> {
  const tokens: OAuthSession = {
    userId: session.identity.userId,
  }

  if (applications.adminApi) {
    const appId = applicationId('admin')
    const realAppId = `${applications.adminApi.storeFqdn}-${appId}`
    const token = session.applications[realAppId]?.accessToken
    if (token) {
      tokens.admin = {token, storeFqdn: applications.adminApi.storeFqdn}
    }
  }

  if (applications.partnersApi) {
    const appId = applicationId('partners')
    tokens.partners = session.applications[appId]?.accessToken
  }

  if (applications.storefrontRendererApi) {
    const appId = applicationId('storefront-renderer')
    tokens.storefront = session.applications[appId]?.accessToken
  }

  if (applications.businessPlatformApi) {
    const appId = applicationId('business-platform')
    tokens.businessPlatform = session.applications[appId]?.accessToken
  }

  if (applications.appManagementApi) {
    const appId = applicationId('app-management')
    tokens.appManagement = session.applications[appId]?.accessToken
  }

  return tokens
}

// Scope Helpers
/**
 * Get a flattened array of scopes for the given applications.
 *
 * @param apps - An object containing the applications we need the scopes for.
 * @returns A flattened array of scopes.
 */
function getFlattenScopes(apps: OAuthApplications): string[] {
  const admin = apps.adminApi?.scopes ?? []
  const partner = apps.partnersApi?.scopes ?? []
  const storefront = apps.storefrontRendererApi?.scopes ?? []
  const businessPlatform = apps.businessPlatformApi?.scopes ?? []
  const appManagement = apps.appManagementApi?.scopes ?? []
  const requestedScopes = [...admin, ...partner, ...storefront, ...businessPlatform, ...appManagement]
  return allDefaultScopes(requestedScopes)
}

/**
 * Get the scopes for the given applications.
 *
 * @param apps - An object containing the applications we need the scopes for.
 * @returns An object containing the scopes for each application.
 */
function getExchangeScopes(apps: OAuthApplications): ExchangeScopes {
  const adminScope = apps.adminApi?.scopes ?? []
  const partnerScope = apps.partnersApi?.scopes ?? []
  const storefrontScopes = apps.storefrontRendererApi?.scopes ?? []
  const businessPlatformScopes = apps.businessPlatformApi?.scopes ?? []
  const appManagementScopes = apps.appManagementApi?.scopes ?? []
  return {
    admin: apiScopes('admin', adminScope),
    partners: apiScopes('partners', partnerScope),
    storefront: apiScopes('storefront-renderer', storefrontScopes),
    businessPlatform: apiScopes('business-platform', businessPlatformScopes),
    appManagement: apiScopes('app-management', appManagementScopes),
  }
}

function buildIdentityTokenFromEnv(
  scopes: string[],
  identityTokenInformation: {accessToken: string; refreshToken: string; userId: string},
) {
  return {
    ...identityTokenInformation,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    scopes,
    alias: identityTokenInformation.userId,
  }
}
