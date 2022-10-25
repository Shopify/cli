import {applicationId} from './session/identity.js'
import {Abort, Bug} from './error.js'
import {validateSession} from './session/validate.js'
import {allDefaultScopes, apiScopes} from './session/scopes.js'
import {identity as identityFqdn, partners as partnersFqdn} from './environment/fqdn.js'
import {open} from './system.js'
import {
  exchangeAccessForApplicationTokens,
  exchangeCodeForAccessToken,
  exchangeCustomPartnerToken,
  ExchangeScopes,
  refreshAccessToken,
  InvalidGrantError,
} from './session/exchange.js'

import {content, token, debug} from './output.js'
import {keypress} from './ui.js'

import {authorize} from './session/authorize.js'
import {IdentityToken, Session} from './session/schema.js'
import * as secureStore from './session/store.js'
import constants from './constants.js'
import {normalizeStoreName} from './string.js'
import * as output from './output.js'
import {partners} from './api.js'
import {RequestClientError} from './api/common.js'
import {firstPartyDev, useDeviceAuth} from './environment/local.js'
import {pollForDeviceAuthorization, requestDeviceAuthorization} from './session/device-authorization.js'
import {gql} from 'graphql-request'

const NoSessionError = new Bug('No session found after ensuring authenticated')
const MissingPartnerTokenError = new Bug('No partners token found after ensuring authenticated')
const MissingAdminTokenError = new Bug('No admin token found after ensuring authenticated')
const MissingStorefrontTokenError = new Bug('No storefront token found after ensuring authenticated')

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

export interface AdminSession {
  token: string
  storeFqdn: string
}

export interface OAuthSession {
  admin?: AdminSession
  partners?: string
  storefront?: string
}

/**
 * Ensure that we have a valid session to access the Partners API.
 * If SHOPIFY_CLI_PARTNERS_TOKEN exists, that token will be used to obtain a valid Partners Token
 * If SHOPIFY_CLI_PARTNERS_TOKEN exists, scopes will be ignored
 * @param scopes - Optional array of extra scopes to authenticate with.
 * @returns The access token for the Partners API.
 */
export async function ensureAuthenticatedPartners(scopes: string[] = [], env = process.env): Promise<string> {
  debug(content`Ensuring that the user is authenticated with the Partners API with the following scopes:
${token.json(scopes)}
`)
  const envToken = env[constants.environmentVariables.partnersToken]
  if (envToken) {
    return (await exchangeCustomPartnerToken(envToken)).accessToken
  }
  const tokens = await ensureAuthenticated({partnersApi: {scopes}})
  if (!tokens.partners) {
    throw MissingPartnerTokenError
  }
  return tokens.partners
}

/**
 * Ensure that we have a valid session to access the Storefront API.
 * @param scopes - Optional array of extra scopes to authenticate with.
 * @returns The access token for the Storefront API.
 */
export async function ensureAuthenticatedStorefront(scopes: string[] = []): Promise<string> {
  debug(content`Ensuring that the user is authenticated with the Storefront API with the following scopes:
${token.json(scopes)}
`)
  const tokens = await ensureAuthenticated({storefrontRendererApi: {scopes}})
  if (!tokens.storefront) {
    throw MissingStorefrontTokenError
  }
  return tokens.storefront
}

/**
 * Ensure that we have a valid Admin session for the given store.
 * @param store - Store fqdn to request auth for
 * @param scopes - Optional array of extra scopes to authenticate with.
 * @returns The access token for the Admin API
 */
export async function ensureAuthenticatedAdmin(
  store: string,
  scopes: string[] = [],
  forceRefresh = false,
): Promise<AdminSession> {
  debug(content`Ensuring that the user is authenticated with the Admin API with the following scopes for the store ${token.raw(
    store,
  )}:
${token.json(scopes)}
`)
  const tokens = await ensureAuthenticated({adminApi: {scopes, storeFqdn: store}}, process.env, forceRefresh)
  if (!tokens.admin) {
    throw MissingAdminTokenError
  }
  return tokens.admin
}

/**
 * Ensure that we have a valid session to access the Theme API.
 * If a password is provided, that token will be used against Theme Access API.
 * Otherwise, it will ensure that the user is authenticated with the Admin API.
 * @param store - Store fqdn to request auth for
 * @param password - Password generated from Theme Access app
 * @param scopes - Optional array of extra scopes to authenticate with.
 * @returns The access token and store
 */
export async function ensureAuthenticatedThemes(
  store: string,
  password: string | undefined,
  scopes: string[] = [],
  forceRefresh = false,
): Promise<AdminSession> {
  debug(content`Ensuring that the user is authenticated with the Theme API with the following scopes:
${token.json(scopes)}
`)
  if (password) return {token: password, storeFqdn: normalizeStoreName(store)}
  return ensureAuthenticatedAdmin(store, scopes, forceRefresh)
}

/**
 * This method ensures that we have a valid session to authenticate against the given applications using the provided scopes.
 * @param applications - An object containing the applications we need to be authenticated with.
 * @returns An instance with the access tokens organized by application.
 */
export async function ensureAuthenticated(
  applications: OAuthApplications,
  env = process.env,
  forceRefresh = false,
): Promise<OAuthSession> {
  const fqdn = await identityFqdn()

  if (applications.adminApi?.storeFqdn) {
    applications.adminApi.storeFqdn = normalizeStoreName(applications.adminApi.storeFqdn)
  }

  const currentSession = (await secureStore.fetch()) || {}
  const fqdnSession = currentSession[fqdn]!
  const scopes = getFlattenScopes(applications)

  debug(content`Validating existing session against the scopes:
${token.json(scopes)}
For applications:
${token.json(applications)}
`)
  const validationResult = await validateSession(scopes, applications, fqdnSession)

  let newSession = {}

  if (validationResult === 'needs_full_auth') {
    debug(content`Initiating the full authentication flow...`)
    newSession = await executeCompleteFlow(applications, fqdn)
  } else if (validationResult === 'needs_refresh' || forceRefresh) {
    debug(content`The current session is valid but needs refresh. Refreshing...`)
    try {
      newSession = await refreshTokens(fqdnSession.identity, applications, fqdn)
    } catch (error) {
      if (error instanceof InvalidGrantError) {
        newSession = await executeCompleteFlow(applications, fqdn)
      } else {
        throw error
      }
    }
  }

  const completeSession: Session = {...currentSession, ...newSession}
  await secureStore.store(completeSession)
  const tokens = await tokensFor(applications, completeSession, fqdn)

  // Overwrite partners token if using a custom CLI Token
  const envToken = env[constants.environmentVariables.partnersToken]
  if (envToken && applications.partnersApi) {
    tokens.partners = (await exchangeCustomPartnerToken(envToken)).accessToken
  }
  if (!envToken && tokens.partners) {
    await ensureUserHasPartnerAccount(tokens.partners)
  }

  return tokens
}

export async function hasPartnerAccount(partnersToken: string): Promise<boolean> {
  try {
    await partners.request(
      gql`
        {
          organizations(first: 1) {
            nodes {
              id
            }
          }
        }
      `,
      partnersToken,
    )
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
 * If the user creates an account from the Identity website, the created
 * account won't get a Partner organization created. We need to detect that
 * and take the user to create a partner organization.
 * @param partnersToken - Partners token
 */
export async function ensureUserHasPartnerAccount(partnersToken: string) {
  debug(content`Verifying that the user has a Partner organization`)
  if (!(await hasPartnerAccount(partnersToken))) {
    output.info(`\nA Shopify Partners organization is needed to proceed.`)
    output.info(`👉 Press any key to create one`)
    await keypress()
    await open(`https://${await partnersFqdn()}/signup`)
    output.info(output.content`👉 Press any key when you have ${output.token.cyan('created the organization')}`)
    output.warn(output.content`Make sure you've confirmed your Shopify and the Partner organization from the email`)
    await keypress()
    if (!(await hasPartnerAccount(partnersToken))) {
      throw new Abort(
        `Couldn't find your Shopify Partners organization`,
        `Have you confirmed your accounts from the emails you received?`,
      )
    }
  }
}

async function executeCompleteFlow(applications: OAuthApplications, identityFqdn: string): Promise<Session> {
  const scopes = getFlattenScopes(applications)
  const exchangeScopes = getExchangeScopes(applications)
  const store = applications.adminApi?.storeFqdn
  if (firstPartyDev()) {
    debug(content`Authenticating as Shopify Employee...`)
    scopes.push('employee')
  }

  let identityToken: IdentityToken
  if (useDeviceAuth()) {
    // Request a device code to authorize without a browser redirect.
    debug(content`Requesting device authorization code...`)
    const deviceAuth = await requestDeviceAuthorization(scopes)

    // Poll for the identity token
    debug(content`Starting polling for the identity token...`)
    identityToken = await pollForDeviceAuthorization(deviceAuth.deviceCode, deviceAuth.interval)
  } else {
    // Authorize user via browser
    debug(content`Authorizing through Identity's website...`)
    const code = await authorize(scopes)

    // Exchange code for identity token
    debug(content`Authorization code received. Exchanging it for a CLI token...`)
    identityToken = await exchangeCodeForAccessToken(code)
  }

  // Exchange identity token for application tokens
  debug(content`CLI token received. Exchanging it for application tokens...`)
  const result = await exchangeAccessForApplicationTokens(identityToken, exchangeScopes, store)

  const session: Session = {
    [identityFqdn]: {
      identity: identityToken,
      applications: result,
    },
  }

  output.completed('Logged in.')

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
    throw NoSessionError
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

export function logout() {
  return secureStore.remove()
}
