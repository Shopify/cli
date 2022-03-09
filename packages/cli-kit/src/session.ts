import {applicationId} from './session/identity'
import {API} from './network/api'
import {allDefaultScopes, apiScopes} from './session/scopes'
import {identity} from './environment/fqdn'
import {
  exchangeAccessForApplicationTokens,
  exchangeCodeForAccessToken,
  ExchangeScopes,
  refreshAccessToken,
} from './session/exchange'
import {authorize} from './session/authorize'
import constants from './constants'
import {ApplicationToken, IdentityToken, Session} from './session/schema'
import * as secureStore from './session/store'

/**
 * A scope supported by the Shopify Admin API.
 */
type AdminAPIScope = 'graphql' | 'themes' | 'collaborator' | string

/**
 * It represents the options to authenticate against the Shopify Admin API.
 */
interface AdminAPIOAuthOptions {
  /** Store to request permissions for */
  storeFqdn: string
  /** List of scopes to request permissions for */
  scopes: AdminAPIScope[]
}

/**
 * A scope supported by the Partners API.
 */
type PartnersAPIScope = 'cli' | string
interface PartnersAPIOAuthOptions {
  /** List of scopes to request permissions for */
  scopes: PartnersAPIScope[]
}

/**
 * A scope supported by the Storefront Renderer API.
 */
type StorefrontRendererScope = 'devtools' | string
interface StorefrontRendererAPIOAuthOptions {
  /** List of scopes to request permissions for */
  scopes: StorefrontRendererScope[]
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
}

/**
 * This method ensures that we have a valid session to authenticate against the given applications using the provided scopes.
 * @param options {OAuthApplications} An object containing the applications we need to be authenticated with.
 * @returns {OAuthSession} An instance with the access tokens organized by application.
 */

// await ensureAuthenticated({
//   adminApi: {
//     storeFqdn: 'myshop.myshopify.com',
//     scopes: [],
//   },
//   storefrontRendererApi: {
//     scopes: [],
//   },
//   partnersApi: {
//     scopes: [],
//   },
// })

export async function ensureAuthenticated(
  applications: OAuthApplications,
): Promise<void> {
  const fqdn = await identity()

  const currentSession = (await secureStore.fetch()) || {}
  const fqdnSession = currentSession[fqdn]

  const needFullAuth =
    !fqdnSession || !validateScopes(applications, fqdnSession.identity)
  const isExpired = fqdnSession && validateToken(fqdnSession.identity)
  const apisAreInvalid =
    fqdnSession && validateApplications(applications, fqdnSession.applications)

  let newSession = {}
  if (needFullAuth) {
    newSession = await executeCompleteFlow(applications, fqdn)
  } else if (isExpired || apisAreInvalid) {
    newSession = await refreshTokens(fqdnSession.identity, applications, fqdn)
  } else {
    // session is valid
    return
  }

  const completeSession: Session = {...currentSession, ...newSession}
  secureStore.store(completeSession)
  console.log(JSON.stringify(completeSession, null, 4))
}

async function executeCompleteFlow(
  applications: OAuthApplications,
  fqdn: string,
): Promise<Session> {
  const scopes = getFlattenScopes(applications)
  const exchangeScopes = getExchangeScopes(applications)
  const store = applications.adminApi?.storeFqdn // || 'isaacroldan.myshopify.com' temporary for testing

  // Authorize user via browser
  const code = await authorize(scopes)

  // Exchange code for identity token
  const identityToken = await exchangeCodeForAccessToken(code)

  // Exchange identity token for application tokens
  const result = await exchangeAccessForApplicationTokens(
    identityToken,
    exchangeScopes,
    store,
  )

  // Store tokens in secure store
  const session: Session = {
    [fqdn]: {
      identity: identityToken,
      applications: result,
    },
  }
  return session
}

async function refreshTokens(
  currentToken: IdentityToken,
  applications: OAuthApplications,
  fqdn: string,
): Promise<Session> {
  const identityToken = await refreshAccessToken(currentToken)
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

// Session validations
function expireThreshold(): Date {
  return new Date(
    new Date().getTime() +
      constants.session.expirationTimeMarginInMinutes * 60 * 1000,
  )
}

function validateScopes(
  applications: OAuthApplications,
  identity: IdentityToken,
) {
  const newScopes = getFlattenScopes(applications)
  const currentScopes = identity.scopes
  return newScopes.every((scope) => currentScopes.includes(scope))
}

function validateToken(token: ApplicationToken): boolean {
  if (!token) return false
  return token.expiresAt < expireThreshold()
}

function validateApplications(
  applications: OAuthApplications,
  currentTokens: {[x: string]: ApplicationToken},
) {
  let tokensAreValid = true
  if (applications.partnersApi) {
    // make sure partners works
    const appId = applicationId('partners')
    const token = currentTokens[appId]
    tokensAreValid &&= validateToken(token)
  }

  if (applications.storefrontRendererApi) {
    const appId = applicationId('storefront-renderer')
    const token = currentTokens[appId]
    tokensAreValid &&= validateToken(token)
  }

  if (applications.adminApi) {
    const appId = applicationId('admin')
    const realAppId = `${applications.adminApi.storeFqdn}-${appId}`
    const token = currentTokens[realAppId]
    tokensAreValid &&= validateToken(token)
  }
  return tokensAreValid
}

// Scope Helpers
function getFlattenScopes(apps: OAuthApplications): string[] {
  const admin = apps.adminApi?.scopes || []
  const partner = apps.partnersApi?.scopes || []
  const storefront = apps.storefrontRendererApi?.scopes || []
  const requestedScopes = [...admin, ...partner, ...storefront]
  return allDefaultScopes(requestedScopes)
}

function getExchangeScopes(apps: OAuthApplications): ExchangeScopes {
  const adminScope = apps.adminApi?.scopes || []
  const partnerScope = apps.partnersApi?.scopes || []
  const storefrontScopes = apps.storefrontRendererApi?.scopes || []
  return {
    admin: apiScopes('admin', adminScope),
    partners: apiScopes('partners', partnerScope),
    storefront: apiScopes('storefront-renderer', storefrontScopes),
  }
}
