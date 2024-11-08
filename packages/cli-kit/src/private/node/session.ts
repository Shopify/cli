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
import {IdentityToken, Session} from './session/schema.js'
import * as secureStore from './session/store.js'
import {pollForDeviceAuthorization, requestDeviceAuthorization} from './session/device-authorization.js'
import {RequestClientError} from './api/headers.js'
import {getCachedPartnerAccountStatus, setCachedPartnerAccountStatus} from './conf-store.js'
import {isThemeAccessSession} from './api/rest.js'
import {outputContent, outputToken, outputDebug} from '../../public/node/output.js'
import {firstPartyDev, themeToken} from '../../public/node/context/local.js'
import {AbortError, BugError} from '../../public/node/error.js'
import {partnersRequest} from '../../public/node/api/partners.js'
import {normalizeStoreFqdn, partnersFqdn, identityFqdn} from '../../public/node/context/fqdn.js'
import {openURL} from '../../public/node/system.js'
import {keypress} from '../../public/node/ui.js'
import {getIdentityTokenInformation, getPartnersToken} from '../../public/node/environment.js'
import {gql} from 'graphql-request'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {outputCompleted, outputInfo, outputWarn} from '@shopify/cli-kit/node/output'
import {isTruthy} from '@shopify/cli-kit/node/context/utilities'
import {isSpin} from '@shopify/cli-kit/node/context/spin'
import {nonRandomUUID} from '@shopify/cli-kit/node/crypto'

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
 * 2. Attempts to fetch it from the secure store (from a previous auth session).
 * 3. Checks if a custom token was used (either as a theme password or partners token).
 * 4. If a custom token is present in the environment, generates a UUID and uses it as userId.
 * 5. If after all this we don't have a userId, then reports as 'unknown'.
 *
 * @returns A Promise that resolves to the user ID as a string.
 */
export async function getLastSeenUserIdAfterAuth(): Promise<string> {
  if (userId) return userId

  const currentSession = (await secureStore.fetch()) || {}
  const fqdn = await identityFqdn()
  const cachedUserId = currentSession[fqdn]?.identity.userId
  if (cachedUserId) return cachedUserId

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

  const currentSession = (await secureStore.fetch()) || {}
  const fqdn = await identityFqdn()
  const cachedUserId = currentSession[fqdn]?.identity.userId
  if (cachedUserId) return 'device_auth'

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

/**
 * This method ensures that we have a valid session to authenticate against the given applications using the provided scopes.
 *
 * @param applications - An object containing the applications we need to be authenticated with.
 * @param _env - Optional environment variables to use.
 * @param forceRefresh - Optional flag to force a refresh of the token.
 * @returns An instance with the access tokens organized by application.
 */
export async function ensureAuthenticated(
  applications: OAuthApplications,
  _env?: NodeJS.ProcessEnv,
  {forceRefresh = false, noPrompt = false}: {forceRefresh?: boolean; noPrompt?: boolean} = {},
): Promise<OAuthSession> {
  const fqdn = await identityFqdn()

  const previousStoreFqdn = applications.adminApi?.storeFqdn
  if (previousStoreFqdn) {
    const normalizedStoreName = await normalizeStoreFqdn(previousStoreFqdn)
    if (previousStoreFqdn === applications.adminApi?.storeFqdn) {
      applications.adminApi.storeFqdn = normalizedStoreName
    }
  }

  const currentSession = (await secureStore.fetch()) || {}
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const fqdnSession = currentSession[fqdn]!
  const scopes = getFlattenScopes(applications)

  outputDebug(outputContent`Validating existing session against the scopes:
${outputToken.json(scopes)}
For applications:
${outputToken.json(applications)}
`)
  const validationResult = await validateSession(scopes, applications, fqdnSession)

  let newSession = {}

  function throwOnNoPrompt() {
    if (!noPrompt || (isSpin() && firstPartyDev())) return
    throw new AbortError(
      `The currently available CLI credentials are invalid.

The CLI is currently unable to prompt for reauthentication.`,
      'Restart the CLI process you were running. If in an interactive terminal, you will be prompted to reauthenticate. If in a non-interactive terminal, ensure the correct credentials are available in the program environment.',
    )
  }

  if (validationResult === 'needs_full_auth') {
    throwOnNoPrompt()
    outputDebug(outputContent`Initiating the full authentication flow...`)
    newSession = await executeCompleteFlow(applications, fqdn)
  } else if (validationResult === 'needs_refresh' || forceRefresh) {
    outputDebug(outputContent`The current session is valid but needs refresh. Refreshing...`)
    try {
      newSession = await refreshTokens(fqdnSession.identity, applications, fqdn)
    } catch (error) {
      if (error instanceof InvalidGrantError) {
        throwOnNoPrompt()
        newSession = await executeCompleteFlow(applications, fqdn)
      } else if (error instanceof InvalidRequestError) {
        await secureStore.remove()
        throw new AbortError('\nError validating auth session', "We've cleared the current session, please try again")
      } else {
        throw error
      }
    }
  }

  const completeSession: Session = {...currentSession, ...newSession}

  // Save the new session info if it has changed
  if (Object.keys(newSession).length > 0) await secureStore.store(completeSession)
  const tokens = await tokensFor(applications, completeSession, fqdn)

  // Overwrite partners token if using a custom CLI Token
  const envToken = getPartnersToken()
  if (envToken && applications.partnersApi) {
    tokens.partners = (await exchangeCustomPartnerToken(envToken)).accessToken
  }
  if (!envToken && tokens.partners) {
    await ensureUserHasPartnerAccount(tokens.partners, tokens.userId)
  }

  setLastSeenAuthMethod(envToken ? 'partners_token' : 'device_auth')
  setLastSeenUserIdAfterAuth(tokens.userId)
  return tokens
}

/**
 * Execute the full authentication flow.
 *
 * @param applications - An object containing the applications we need to be authenticated with.
 * @param identityFqdn - The identity FQDN.
 */
async function executeCompleteFlow(applications: OAuthApplications, identityFqdn: string): Promise<Session> {
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
    const deviceAuth = await requestDeviceAuthorization(scopes)

    // Poll for the identity token
    outputDebug(outputContent`Starting polling for the identity token...`)
    identityToken = await pollForDeviceAuthorization(deviceAuth.deviceCode, deviceAuth.interval)
  }

  // Exchange identity token for application tokens
  outputDebug(outputContent`CLI token received. Exchanging it for application tokens...`)
  const result = await exchangeAccessForApplicationTokens(identityToken, exchangeScopes, store)

  const session: Session = {
    [identityFqdn]: {
      identity: identityToken,
      applications: result,
    },
  }

  outputCompleted('Logged in.')

  return session
}

/**
 * If the user creates an account from the Identity website, the created
 * account won't get a Partner organization created. We need to detect that
 * and take the user to create a partner organization.
 *
 * @param partnersToken - Partners token.
 */
async function ensureUserHasPartnerAccount(partnersToken: string, userId: string | undefined) {
  if (isTruthy(process.env.USE_APP_MANAGEMENT_API)) return

  outputDebug(outputContent`Verifying that the user has a Partner organization`)
  if (!(await hasPartnerAccount(partnersToken, userId))) {
    outputInfo(`\nA Shopify Partners organization is needed to proceed.`)
    outputInfo(`👉 Press any key to create one`)
    await keypress()
    await openURL(`https://${await partnersFqdn()}/signup`)
    outputInfo(outputContent`👉 Press any key when you have ${outputToken.cyan('created the organization')}`)
    outputWarn(outputContent`Make sure you've confirmed your Shopify and the Partner organization from the email`)
    await keypress()
    if (!(await hasPartnerAccount(partnersToken, userId))) {
      throw new AbortError(
        `Couldn't find your Shopify Partners organization`,
        `Have you confirmed your accounts from the emails you received?`,
      )
    }
  }
}

// eslint-disable-next-line @shopify/cli/no-inline-graphql
const getFirstOrganization = gql`
  {
    organizations(first: 1) {
      nodes {
        id
      }
    }
  }
`

/**
 * Validate if the current token is valid for partners API.
 *
 * @param partnersToken - Partners token.
 * @returns A promise that resolves to true if the token is valid for partners API.
 */
async function hasPartnerAccount(partnersToken: string, userId?: string): Promise<boolean> {
  const cacheKey = userId ?? partnersToken
  const cachedStatus = getCachedPartnerAccountStatus(cacheKey)

  if (cachedStatus) {
    outputDebug(`Confirmed partner account exists from cache`)
    return true
  }

  try {
    await partnersRequest(getFirstOrganization, partnersToken)
    setCachedPartnerAccountStatus(cacheKey)
    return true
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    if (error instanceof RequestClientError && error.statusCode === 404) {
      return false
    } else {
      return true
    }
  }
}

/**
 * Refresh the tokens for a given session.
 *
 * @param token - Identity token.
 * @param applications - An object containing the applications we need to be authenticated with.
 * @param fqdn - The identity FQDN.
 */
async function refreshTokens(token: IdentityToken, applications: OAuthApplications, fqdn: string): Promise<Session> {
  // Refresh Identity Token
  const identityToken = await refreshAccessToken(token)
  // Exchange new identity token for application tokens
  const exchangeScopes = getExchangeScopes(applications)
  const applicationTokens = await exchangeAccessForApplicationTokens(
    identityToken,
    exchangeScopes,
    applications.adminApi?.storeFqdn,
  )

  return {
    [fqdn]: {
      identity: identityToken,
      applications: applicationTokens,
    },
  }
}

/**
 * Get the application tokens for a given session.
 *
 * @param applications - An object containing the applications we need the tokens for.
 * @param session - The current session.
 * @param fqdn - The identity FQDN.
 */
async function tokensFor(applications: OAuthApplications, session: Session, fqdn: string): Promise<OAuthSession> {
  const fqdnSession = session[fqdn]
  if (!fqdnSession) {
    throw new BugError('No session found after ensuring authenticated')
  }
  const tokens: OAuthSession = {
    userId: fqdnSession.identity.userId,
  }
  if (applications.adminApi) {
    const appId = applicationId('admin')
    const realAppId = `${applications.adminApi.storeFqdn}-${appId}`
    const token = fqdnSession.applications[realAppId]?.accessToken
    if (token) {
      tokens.admin = {token, storeFqdn: applications.adminApi.storeFqdn}
    }
  }

  if (applications.partnersApi) {
    const appId = applicationId('partners')
    tokens.partners = fqdnSession.applications[appId]?.accessToken
  }

  if (applications.storefrontRendererApi) {
    const appId = applicationId('storefront-renderer')
    tokens.storefront = fqdnSession.applications[appId]?.accessToken
  }

  if (applications.businessPlatformApi) {
    const appId = applicationId('business-platform')
    tokens.businessPlatform = fqdnSession.applications[appId]?.accessToken
  }

  if (applications.appManagementApi) {
    const appId = applicationId('app-management')
    tokens.appManagement = fqdnSession.applications[appId]?.accessToken
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
  const admin = apps.adminApi?.scopes || []
  const partner = apps.partnersApi?.scopes || []
  const storefront = apps.storefrontRendererApi?.scopes || []
  const businessPlatform = apps.businessPlatformApi?.scopes || []
  const appManagement = apps.appManagementApi?.scopes || []
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
  const adminScope = apps.adminApi?.scopes || []
  const partnerScope = apps.partnersApi?.scopes || []
  const storefrontScopes = apps.storefrontRendererApi?.scopes || []
  const businessPlatformScopes = apps.businessPlatformApi?.scopes || []
  const appManagementScopes = apps.appManagementApi?.scopes || []
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
  }
}
