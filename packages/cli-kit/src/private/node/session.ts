import {applicationId} from './session/identity.js'
import {validateSession} from './session/validate.js'
import {allDefaultScopes, apiScopes} from './session/scopes.js'
import {
  exchangeAccessForApplicationTokens,
  exchangeCodeForAccessToken,
  exchangeCustomPartnerToken,
  ExchangeScopes,
  refreshAccessToken,
  InvalidGrantError,
  InvalidRequestError,
} from './session/exchange.js'
import {authorize} from './session/authorize.js'
import {IdentityToken, Session} from './session/schema.js'
import * as secureStore from './session/store.js'
import {pollForDeviceAuthorization, requestDeviceAuthorization} from './session/device-authorization.js'
import {RequestClientError} from './api/headers.js'
import {outputContent, outputToken, outputDebug} from '../../public/node/output.js'
import {firstPartyDev, useDeviceAuth} from '../../public/node/context/local.js'
import {AbortError, BugError} from '../../public/node/error.js'
import {partnersRequest} from '../../public/node/api/partners.js'
import {normalizeStoreFqdn, partnersFqdn, identityFqdn} from '../../public/node/context/fqdn.js'
import {openURL} from '../../public/node/system.js'
import {keypress} from '../../public/node/ui.js'
import {getIdentityTokenInformation, getPartnersToken} from '../../public/node/environment.js'
import {gql} from 'graphql-request'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {outputCompleted, outputInfo, outputWarn} from '@shopify/cli-kit/node/output'

/**
 * A scope supported by the Shopify Admin API.
 */
type AdminAPIScope = 'graphql' | 'themes' | 'collaborator' | string

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
type PartnersAPIScope = 'cli' | string
interface PartnersAPIOAuthOptions {
  /** List of scopes to request permissions for. */
  scopes: PartnersAPIScope[]
}

/**
 * A scope supported by the Storefront Renderer API.
 */
type StorefrontRendererScope = 'devtools' | string
interface StorefrontRendererAPIOAuthOptions {
  /** List of scopes to request permissions for. */
  scopes: StorefrontRendererScope[]
}

type BusinessPlatformScope = 'destinations' | string
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
}

export interface OAuthSession {
  admin?: AdminSession
  partners?: string
  storefront?: string
  businessPlatform?: string
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
  const fqdnSession = currentSession[fqdn]!
  const scopes = getFlattenScopes(applications)

  outputDebug(outputContent`Validating existing session against the scopes:
${outputToken.json(scopes)}
For applications:
${outputToken.json(applications)}
`)
  const validationResult = await validateSession(scopes, applications, fqdnSession)

  let newSession = {}

  if (validationResult === 'needs_full_auth') {
    if (noPrompt) {
      throw new AbortError(
        `The currently available CLI credentials are invalid.

The CLI is currently unable to prompt for reauthentication.`,
        'Restart the CLI process you were running. If in an interactive terminal, you will be prompted to reauthenticate. If in a non-interactive terminal, ensure the correct credentials are available in the program environment.',
      )
    }
    outputDebug(outputContent`Initiating the full authentication flow...`)
    newSession = await executeCompleteFlow(applications, fqdn)
  } else if (validationResult === 'needs_refresh' || forceRefresh) {
    outputDebug(outputContent`The current session is valid but needs refresh. Refreshing...`)
    try {
      newSession = await refreshTokens(fqdnSession.identity, applications, fqdn)
    } catch (error) {
      if (error instanceof InvalidGrantError) {
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
    await ensureUserHasPartnerAccount(tokens.partners)
  }

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
  } else if (useDeviceAuth()) {
    // Request a device code to authorize without a browser redirect.
    outputDebug(outputContent`Requesting device authorization code...`)
    const deviceAuth = await requestDeviceAuthorization(scopes)

    // Poll for the identity token
    outputDebug(outputContent`Starting polling for the identity token...`)
    identityToken = await pollForDeviceAuthorization(deviceAuth.deviceCode, deviceAuth.interval)
  } else {
    // Authorize user via browser
    outputDebug(outputContent`Authorizing through Identity's website...`)
    const code = await authorize(scopes)

    // Exchange code for identity token
    outputDebug(outputContent`Authorization code received. Exchanging it for a CLI token...`)
    identityToken = await exchangeCodeForAccessToken(code)
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
async function ensureUserHasPartnerAccount(partnersToken: string) {
  outputDebug(outputContent`Verifying that the user has a Partner organization`)
  if (!(await hasPartnerAccount(partnersToken))) {
    outputInfo(`\nA Shopify Partners organization is needed to proceed.`)
    outputInfo(`👉 Press any key to create one`)
    await keypress()
    await openURL(`https://${await partnersFqdn()}/signup`)
    outputInfo(outputContent`👉 Press any key when you have ${outputToken.cyan('created the organization')}`)
    outputWarn(outputContent`Make sure you've confirmed your Shopify and the Partner organization from the email`)
    await keypress()
    if (!(await hasPartnerAccount(partnersToken))) {
      throw new AbortError(
        `Couldn't find your Shopify Partners organization`,
        `Have you confirmed your accounts from the emails you received?`,
      )
    }
  }
}

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
async function hasPartnerAccount(partnersToken: string): Promise<boolean> {
  try {
    await partnersRequest(getFirstOrganization, partnersToken)
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
  const tokens: OAuthSession = {}
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
  const requestedScopes = [...admin, ...partner, ...storefront, ...businessPlatform]
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
  return {
    admin: apiScopes('admin', adminScope),
    partners: apiScopes('partners', partnerScope),
    storefront: apiScopes('storefront-renderer', storefrontScopes),
    businessPlatform: apiScopes('business-platform', businessPlatformScopes),
  }
}

function buildIdentityTokenFromEnv(
  scopes: string[],
  identityTokenInformation: {accessToken: string; refreshToken: string},
) {
  return {
    ...identityTokenInformation,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    scopes,
  }
}
