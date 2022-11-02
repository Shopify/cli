import {ApplicationToken, IdentityToken} from './schema.js'
import {applicationId, clientId as getIdentityClientId} from './identity.js'
import {CodeAuthResult} from './authorize.js'
import * as secureStore from './store.js'
import {Abort} from '../error.js'
import {API} from '../network/api.js'
import {identity as identityFqdn} from '../environment/fqdn.js'
import {shopifyFetch} from '../http.js'
import {err, ok, Result} from '../public/common/result.js'
import {AbortError} from '../public/node/error.js'

export class InvalidGrantError extends Error {}

const InvalidIdentityError = () =>
  new Abort('\nError validating auth session', "We've cleared the current session, please try again")

export interface ExchangeScopes {
  admin: string[]
  partners: string[]
  storefront: string[]
}
/**
 * Given a valid authorization code, request an identity access token.
 * This token can then be used to get API specific tokens.
 * @param codeData - code and codeVerifier from the authorize endpoint
 * @returns An instance with the identity access tokens.
 */
export async function exchangeCodeForAccessToken(codeData: CodeAuthResult): Promise<IdentityToken> {
  const clientId = await getIdentityClientId()
  const params = {
    grant_type: 'authorization_code',
    code: codeData.code,
    redirect_uri: 'http://127.0.0.1:3456',
    client_id: clientId,
    code_verifier: codeData.codeVerifier,
  }

  const tokenResult = await tokenRequest(params)
  const value = tokenResult.mapError(tokenRequestErrorHandler).valueOrThrow()
  return buildIdentityToken(value)
}

/**
 * Given an identity token, request an application token.
 * @param identityToken - access token obtained in a previous step
 * @param store - the store to use, only needed for admin API
 * @returns An array with the application access tokens.
 */
export async function exchangeAccessForApplicationTokens(
  identityToken: IdentityToken,
  scopes: ExchangeScopes,
  store?: string,
): Promise<{[x: string]: ApplicationToken}> {
  const token = identityToken.accessToken

  const partners = await requestAppToken('partners', token, scopes.partners)
  const storefront = await requestAppToken('storefront-renderer', token, scopes.storefront)

  const result = {
    ...partners,
    ...storefront,
  }

  if (store) {
    const admin = await requestAppToken('admin', token, scopes.admin, store)
    Object.assign(result, admin)
  }
  return result
}

/**
 * Given an expired access token, refresh it to get a new one.
 */
export async function refreshAccessToken(currentToken: IdentityToken): Promise<IdentityToken> {
  const clientId = await getIdentityClientId()
  const params = {
    grant_type: 'refresh_token',
    access_token: currentToken.accessToken,
    refresh_token: currentToken.refreshToken,
    client_id: clientId,
  }
  const tokenResult = await tokenRequest(params)
  const value = tokenResult.mapError(tokenRequestErrorHandler).valueOrThrow()
  return buildIdentityToken(value)
}

/**
 * Given a custom CLI token passed as ENV variable, request a valid partners API token
 * This token does not accept extra scopes, just the cli one.
 * @param token - The CLI token passed as ENV variable
 * @returns An instance with the application access tokens.
 */
export async function exchangeCustomPartnerToken(token: string): Promise<ApplicationToken> {
  const appId = applicationId('partners')
  const newToken = await requestAppToken('partners', token, ['https://api.shopify.com/auth/partners.app.cli.access'])
  return newToken[appId]!
}

export type IdentityDeviceError =
  | 'authorization_pending'
  | 'access_denied'
  | 'expired_token'
  | 'slow_down'
  | 'unknown_failure'

/**
 * Given a deviceCode obtained after starting a device identity flow, request an identity token.
 * @param deviceCode - The device code obtained after starting a device identity flow
 * @param scopes - The scopes to request
 * @returns An instance with the identity access tokens.
 */
export async function exchangeDeviceCodeForAccessToken(
  deviceCode: string,
): Promise<Result<IdentityToken, IdentityDeviceError>> {
  const clientId = await getIdentityClientId()

  const params = {
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    device_code: deviceCode,
    client_id: clientId,
  }

  const tokenResult = await tokenRequest(params)
  if (tokenResult.isErr()) {
    return err(tokenResult.error as IdentityDeviceError)
  }
  const identityToken = buildIdentityToken(tokenResult.value)
  return ok(identityToken)
}

async function requestAppToken(
  api: API,
  token: string,
  scopes: string[] = [],
  store?: string,
): Promise<{[x: string]: ApplicationToken}> {
  const appId = applicationId(api)
  const clientId = await getIdentityClientId()

  const params = {
    grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
    requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
    subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
    client_id: clientId,
    audience: appId,
    scope: scopes.join(' '),
    subject_token: token,
    ...(api === 'admin' && {destination: `https://${store}/admin`}),
  }

  let identifier = appId
  if (api === 'admin' && store) {
    identifier = `${store}-${appId}`
  }
  const tokenResult = await tokenRequest(params)
  const value = tokenResult.mapError(tokenRequestErrorHandler).valueOrThrow()
  const appToken = await buildApplicationToken(value)
  return {[identifier]: appToken}
}

interface TokenRequestResult {
  access_token: string
  expires_in: number
  refresh_token: string
  scope: string
}

async function tokenRequestErrorHandler(error: string) {
  if (error === 'invalid_grant') {
    // There's an scenario when Identity returns "invalid_grant" when trying to refresh the token
    // using a valid refresh token. When that happens, we take the user through the authentication flow.
    return new InvalidGrantError()
  }
  if (error === 'invalid_request') {
    // There's an scenario when Identity returns "invalid_request" when exchanging an identity token.
    // This means the token is invalid. We clear the session and throw an error to let the caller know.
    await secureStore.remove()
    return new AbortError('\nError validating auth session', "We've cleared the current session, please try again")
  }
  return new AbortError(error)
}

async function tokenRequest(params: {[key: string]: string}): Promise<Result<TokenRequestResult, string>> {
  const fqdn = await identityFqdn()
  const url = new URL(`https://${fqdn}/oauth/token`)
  url.search = new URLSearchParams(Object.entries(params)).toString()
  const res = await shopifyFetch(url.href, {method: 'POST'})
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = await res.json()

  if (res.ok) return ok(payload)
  return err(payload.error)
}

function buildIdentityToken(result: TokenRequestResult): IdentityToken {
  return {
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    expiresAt: new Date(Date.now() + result.expires_in * 1000),
    scopes: result.scope.split(' '),
  }
}

function buildApplicationToken(result: TokenRequestResult): ApplicationToken {
  return {
    accessToken: result.access_token,
    expiresAt: new Date(Date.now() + result.expires_in * 1000),
    scopes: result.scope.split(' '),
  }
}
