import {applicationId} from './session/identity'
import {Bug} from './error'
import {validateScopes, validateSession} from './session/validate'
import {allDefaultScopes, apiScopes} from './session/scopes'
import {identity as identityFqdn} from './environment/fqdn'
import {
  exchangeAccessForApplicationTokens,
  exchangeCodeForAccessToken,
  exchangeCustomPartnerToken,
  ExchangeScopes,
  refreshAccessToken,
} from './session/exchange'
import {authorize} from './session/authorize'
import {IdentityToken, Session} from './session/schema'
import * as secureStore from './session/store'
import {cliKit} from './store'

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

export interface OAuthSession {
  admin?: string
  partners?: string
  storefront?: string
}

/**
 * Ensure that we have a valid session to access the Partners API.
 * If SHOPIFY_CLI_PARTNERS_TOKEN exists, that token will be returned.
 * @returns {Promise<string>} The access token for the Partners API.
 */
export async function ensureAuthenticatedPartners(): Promise<string> {
  const envToken = process.env.SHOPIFY_CLI_PARTNERS_TOKEN
  if (envToken) {
    return refreshPartnersToken(envToken)
  }
  const tokens = await ensureAuthenticated({partnersApi: {scopes: []}})
  if (!tokens.partners) {
    throw new Bug('No partners token found after ensuring authenticated')
  }
  return tokens.partners
}

/**
 * Ensure that we have a valid session to access the Storefront API.
 * @returns {Promise<string>} The access token for the Storefront API.
 */
export async function ensureAuthenticatedStorefront(): Promise<string> {
  const tokens = await ensureAuthenticated({storefrontRendererApi: {scopes: []}})
  if (!tokens.storefront) {
    throw new Bug('No storefront token found after ensuring authenticated')
  }
  return tokens.storefront
}

/**
 * Ensure that we have a valid Admin session for the given store.
 * If the session is valid, the store will be saved as the `activeStore` for future usage.
 * If no store is passed we will try to use the `activeStore` if there is any.
 * @param store {string} Store fqdn to request auth for
 * @returns {Promise<string>} The access token for the Admin API
 */
export async function ensureAuthenticatedAdmin(store?: string): Promise<string> {
  const validStore = store || cliKit.get('activeStore')
  if (!validStore) {
    throw new Error('No valid store found')
  }
  const tokens = await ensureAuthenticated({adminApi: {scopes: [], storeFqdn: validStore}})
  if (!tokens.admin) {
    throw new Bug('No admin token found after ensuring authenticated')
  }
  cliKit.set('activeStore', store)
  return tokens.admin
}

/**
 * This method ensures that we have a valid session to authenticate against the given applications using the provided scopes.
 * @param applications {OAuthApplications} An object containing the applications we need to be authenticated with.
 * @returns {OAuthSession} An instance with the access tokens organized by application.
 */
export async function ensureAuthenticated(applications: OAuthApplications): Promise<OAuthSession> {
  const fqdn = await identityFqdn()

  const currentSession = (await secureStore.fetchSession()) || {}
  const fqdnSession = currentSession[fqdn]
  const scopes = getFlattenScopes(applications)

  const needFullAuth = !fqdnSession || !validateScopes(scopes, fqdnSession.identity)
  const sessionIsInvalid = !validateSession(applications, fqdnSession)
  const envToken = process.env.SHOPIFY_CLI_PARTNERS_TOKEN

  let newSession = {}
  if (needFullAuth) {
    newSession = await executeCompleteFlow(applications, fqdn)
  } else if (sessionIsInvalid) {
    newSession = await refreshTokens(fqdnSession.identity, applications, fqdn)
  }

  const completeSession: Session = {...currentSession, ...newSession}
  await secureStore.store(completeSession)
  return tokensFor(applications, completeSession, fqdn)
}

async function executeCompleteFlow(applications: OAuthApplications, identityFqdn: string): Promise<Session> {
  const scopes = getFlattenScopes(applications)
  const exchangeScopes = getExchangeScopes(applications)
  const store = applications.adminApi?.storeFqdn

  // Authorize user via browser
  const code = await authorize(scopes)

  // Exchange code for identity token
  const identityToken = await exchangeCodeForAccessToken(code)

  // Exchange identity token for application tokens
  const result = await exchangeAccessForApplicationTokens(identityToken, exchangeScopes, store)

  const session: Session = {
    [identityFqdn]: {
      identity: identityToken,
      applications: result,
    },
  }
  return session
}

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

async function tokensFor(applications: OAuthApplications, session: Session, fqdn: string): Promise<OAuthSession> {
  const fqdnSession = session[fqdn]
  if (!fqdnSession) {
    throw new Bug('No session found after ensuring authenticated')
  }
  const tokens: OAuthSession = {}
  if (applications.adminApi) {
    const appId = applicationId('admin')
    const realAppId = `${applications.adminApi.storeFqdn}-${appId}`
    tokens.admin = fqdnSession.applications[realAppId]?.accessToken
  }

  if (applications.partnersApi) {
    const appId = applicationId('partners')
    tokens.partners = fqdnSession.applications[appId]?.accessToken
  }

  if (applications.storefrontRendererApi) {
    const appId = applicationId('storefront-renderer')
    tokens.storefront = fqdnSession.applications[appId]?.accessToken
  }
  return tokens
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
