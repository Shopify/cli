import {normalizeStoreFqdn} from './context/fqdn.js'
import {BugError} from './error.js'
import {getPartnersToken} from './environment.js'
import * as secureStore from '../../private/node/session/store.js'
import {exchangeCustomPartnerToken} from '../../private/node/session/exchange.js'
import {outputContent, outputToken, outputDebug} from '../../public/node/output.js'
import {ensureAuthenticated, getLastSeenUserIdAfterAuth} from '../../private/node/session.js'

/**
 * Session Object to access the Admin API, includes the token and the store FQDN.
 */
export interface AdminSession {
  token: string
  storeFqdn: string
}

interface EnsureAuthenticatedAdditionalOptions {
  noPrompt?: boolean
}

/**
 * Ensure that we have a valid session to access the Partners API.
 * If SHOPIFY_CLI_PARTNERS_TOKEN exists, that token will be used to obtain a valid Partners Token
 * If SHOPIFY_CLI_PARTNERS_TOKEN exists, scopes will be ignored.
 *
 * @param scopes - Optional array of extra scopes to authenticate with.
 * @param env - Optional environment variables to use.
 * @param options - Optional extra options to use.
 * @returns The access token for the Partners API, and the user's ID.
 */
export async function ensureAuthenticatedPartners(
  scopes: string[] = [],
  env = process.env,
  options: EnsureAuthenticatedAdditionalOptions = {},
): Promise<string> {
  outputDebug(outputContent`Ensuring that the user is authenticated with the Partners API with the following scopes:
${outputToken.json(scopes)}
`)
  const envToken = getPartnersToken()
  if (envToken) {
    return (await exchangeCustomPartnerToken(envToken)).accessToken
  }
  const tokens = await ensureAuthenticated({partnersApi: {scopes}}, env, options)
  if (!tokens.partners) {
    throw new BugError('No partners token found after ensuring authenticated')
  }
  return tokens.partners
}

/**
 * Ensures the user is authenticated, returns their user ID.
 *
 * If the CLI already ran `ensureAuthenticated` earlier -- under any context -- it won't repeat any work.
 *
 * @param env - Optional environment variables to use.
 * @returns User ID, this should be the same for the same human beings.
 */
export async function ensureAuthenticatedUserId(env = process.env): Promise<string> {
  outputDebug(outputContent`Ensuring that the user is authenticated, and gathering their identity`)
  const lastUserId = getLastSeenUserIdAfterAuth()
  if (lastUserId) {
    outputDebug(`Using user ID from prior authentication flow`)
    return lastUserId
  }

  const tokens = await ensureAuthenticated({}, env, {})
  return tokens.userId
}

/**
 * Ensure that we have a valid session to access the App Management API.
 *
 * @param scopes - Optional array of extra scopes to authenticate with.
 * @param env - Optional environment variables to use.
 * @param options - Optional extra options to use.
 * @returns The access token for the App Management API.
 */
export async function ensureAuthenticatedAppManagement(
  scopes: string[] = [],
  env = process.env,
  options: EnsureAuthenticatedAdditionalOptions = {},
): Promise<string> {
  outputDebug(outputContent`Ensuring that the user is authenticated with the App Management API with the following scopes:
${outputToken.json(scopes)}
`)
  const tokens = await ensureAuthenticated({appManagementApi: {scopes}}, env, options)
  if (!tokens) {
    throw new BugError('No App Management token found after ensuring authenticated')
  }
  return tokens.appManagement!
}

/**
 * Ensure that we have a valid session to access the Storefront API.
 *
 * @param scopes - Optional array of extra scopes to authenticate with.
 * @param password - Optional password to use.
 * @param forceRefresh - Optional flag to force a refresh of the token.
 * @returns The access token for the Storefront API.
 */
export async function ensureAuthenticatedStorefront(
  scopes: string[] = [],
  password: string | undefined = undefined,
  forceRefresh = false,
): Promise<string> {
  if (password) return password

  outputDebug(outputContent`Ensuring that the user is authenticated with the Storefront API with the following scopes:
${outputToken.json(scopes)}
`)
  const tokens = await ensureAuthenticated({storefrontRendererApi: {scopes}}, process.env, {forceRefresh})
  if (!tokens.storefront) {
    throw new BugError('No storefront token found after ensuring authenticated')
  }
  return tokens.storefront
}

/**
 * Ensure that we have a valid Admin session for the given store.
 *
 * @param store - Store fqdn to request auth for.
 * @param scopes - Optional array of extra scopes to authenticate with.
 * @param forceRefresh - Optional flag to force a refresh of the token.
 * @param options - Optional extra options to use.
 * @returns The access token for the Admin API.
 */
export async function ensureAuthenticatedAdmin(
  store: string,
  scopes: string[] = [],
  forceRefresh = false,
  options: EnsureAuthenticatedAdditionalOptions = {},
): Promise<AdminSession> {
  outputDebug(outputContent`Ensuring that the user is authenticated with the Admin API with the following scopes for the store ${outputToken.raw(
    store,
  )}:
${outputToken.json(scopes)}
`)
  const tokens = await ensureAuthenticated({adminApi: {scopes, storeFqdn: store}}, process.env, {
    forceRefresh,
    ...options,
  })
  if (!tokens.admin) {
    throw new BugError('No admin token found after ensuring authenticated')
  }
  return tokens.admin
}

/**
 * Ensure that we have a valid session to access the Theme API.
 * If a password is provided, that token will be used against Theme Access API.
 * Otherwise, it will ensure that the user is authenticated with the Admin API.
 *
 * @param store - Store fqdn to request auth for.
 * @param password - Password generated from Theme Access app.
 * @param scopes - Optional array of extra scopes to authenticate with.
 * @param forceRefresh - Optional flag to force a refresh of the token.
 * @returns The access token and store.
 */
export async function ensureAuthenticatedThemes(
  store: string,
  password: string | undefined,
  scopes: string[] = [],
  forceRefresh = false,
): Promise<AdminSession> {
  outputDebug(outputContent`Ensuring that the user is authenticated with the Theme API with the following scopes:
${outputToken.json(scopes)}
`)
  if (password) return {token: password, storeFqdn: await normalizeStoreFqdn(store)}
  return ensureAuthenticatedAdmin(store, scopes, forceRefresh)
}

/**
 * Ensure that we have a valid session to access the Business Platform API.
 *
 * @param scopes - Optional array of extra scopes to authenticate with.
 * @returns The access token for the Business Platform API.
 */
export async function ensureAuthenticatedBusinessPlatform(scopes: string[] = []): Promise<string> {
  outputDebug(outputContent`Ensuring that the user is authenticated with the Business Platform API with the following scopes:
${outputToken.json(scopes)}
`)
  const tokens = await ensureAuthenticated({businessPlatformApi: {scopes}}, process.env)
  if (!tokens.businessPlatform) {
    throw new BugError('No business-platform token found after ensuring authenticated')
  }
  return tokens.businessPlatform
}

/**
 * Logout from Shopify.
 *
 * @returns A promise that resolves when the logout is complete.
 */
export function logout(): Promise<void> {
  return secureStore.remove()
}
