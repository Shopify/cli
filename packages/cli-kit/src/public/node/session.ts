import {normalizeStoreFqdn} from './environment/fqdn.js'
import {BugError} from './error.js'
import * as secureStore from '../../private/node/session/store.js'
import {exchangeCustomPartnerToken} from '../../private/node/session/exchange.js'
import {outputContent, outputToken, outputDebug} from '../../public/node/output.js'
import {ensureAuthenticated} from '../../private/node/session.js'
import {environmentVariables} from '../../private/node/constants.js'

/**
 * Session Object to access the Admin API, includes the token and the store FQDN.
 */
export interface AdminSession {
  token: string
  storeFqdn: string
}

/**
 * Ensure that we have a valid session to access the Partners API.
 * If SHOPIFY_CLI_PARTNERS_TOKEN exists, that token will be used to obtain a valid Partners Token
 * If SHOPIFY_CLI_PARTNERS_TOKEN exists, scopes will be ignored.
 *
 * @param scopes - Optional array of extra scopes to authenticate with.
 * @param env - Optional environment variables to use.
 * @returns The access token for the Partners API.
 */
export async function ensureAuthenticatedPartners(scopes: string[] = [], env = process.env): Promise<string> {
  outputDebug(outputContent`Ensuring that the user is authenticated with the Partners API with the following scopes:
${outputToken.json(scopes)}
`)
  const envToken = env[environmentVariables.partnersToken]
  if (envToken) {
    return (await exchangeCustomPartnerToken(envToken)).accessToken
  }
  const tokens = await ensureAuthenticated({partnersApi: {scopes}})
  if (!tokens.partners) {
    throw new BugError('No partners token found after ensuring authenticated')
  }
  return tokens.partners
}

/**
 * Ensure that we have a valid session to access the Storefront API.
 *
 * @param scopes - Optional array of extra scopes to authenticate with.
 * @param password - Optional password to use.
 * @returns The access token for the Storefront API.
 */
export async function ensureAuthenticatedStorefront(
  scopes: string[] = [],
  password: string | undefined = undefined,
): Promise<string> {
  if (password) return password

  outputDebug(outputContent`Ensuring that the user is authenticated with the Storefront API with the following scopes:
${outputToken.json(scopes)}
`)
  const tokens = await ensureAuthenticated({storefrontRendererApi: {scopes}})
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
 * @returns The access token for the Admin API.
 */
export async function ensureAuthenticatedAdmin(
  store: string,
  scopes: string[] = [],
  forceRefresh = false,
): Promise<AdminSession> {
  outputDebug(outputContent`Ensuring that the user is authenticated with the Admin API with the following scopes for the store ${outputToken.raw(
    store,
  )}:
${outputToken.json(scopes)}
`)
  const tokens = await ensureAuthenticated({adminApi: {scopes, storeFqdn: store}}, process.env, forceRefresh)
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
 * Logout from Shopify.
 *
 * @returns A promise that resolves when the logout is complete.
 */
export function logout(): Promise<void> {
  return secureStore.remove()
}
