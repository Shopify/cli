import {ApplicationToken, IdentityToken} from './schema.js'
import {applicationId, clientId as getIdentityClientId} from './identity.js'
import {CodeAuthResult} from './authorize.js'
import {API} from '../api.js'
import {identityFqdn} from '../../../public/node/context/fqdn.js'
import {shopifyFetch} from '../../../public/node/http.js'
import {err, ok, Result} from '../../../public/node/result.js'
import {AbortError, BugError, ExtendableError} from '../../../public/node/error.js'
import {setLastSeenUserIdAfterAuth} from '../session.js'
import {isTruthy} from '@shopify/cli-kit/node/context/utilities'
import * as jose from 'jose'
import {nonRandomUUID} from '@shopify/cli-kit/node/crypto'

export class InvalidGrantError extends ExtendableError {}
export class InvalidRequestError extends ExtendableError {}
class InvalidTargetError extends AbortError {}

export interface ExchangeScopes {
  admin: string[]
  partners: string[]
  storefront: string[]
  businessPlatform: string[]
  appManagement: string[]
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
  const value = tokenResult.mapError(tokenRequestErrorHandler).valueOrBug()
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
  const appManagementEnabled = isTruthy(process.env.USE_APP_MANAGEMENT_API)

  const [partners, storefront, businessPlatform, admin, appManagement] = await Promise.all([
    requestAppToken('partners', token, scopes.partners),
    requestAppToken('storefront-renderer', token, scopes.storefront),
    requestAppToken('business-platform', token, scopes.businessPlatform),
    store ? requestAppToken('admin', token, scopes.admin, store) : {},
    appManagementEnabled ? requestAppToken('app-management', token, scopes.appManagement) : {},
  ])

  return {
    ...partners,
    ...storefront,
    ...businessPlatform,
    ...admin,
    ...appManagement,
  }
}

/**
 * Given an expired access token, refresh it to get a new one.
 */
export async function refreshAccessToken(currentToken: IdentityToken): Promise<IdentityToken> {
  const clientId = getIdentityClientId()
  const params = {
    grant_type: 'refresh_token',
    access_token: currentToken.accessToken,
    refresh_token: currentToken.refreshToken,
    client_id: clientId,
  }
  const tokenResult = await tokenRequest(params)
  const value = tokenResult.mapError(tokenRequestErrorHandler).valueOrBug()
  return buildIdentityToken(value, currentToken.userId)
}

/**
 * Given a custom CLI token passed as ENV variable, request a valid partners API token
 * This token does not accept extra scopes, just the cli one.
 * @param token - The CLI token passed as ENV variable
 * @returns An instance with the application access tokens.
 */
export async function exchangeCustomPartnerToken(token: string): Promise<{accessToken: string; userId: string}> {
  const appId = applicationId('partners')
  try {
    const newToken = await requestAppToken('partners', token, ['https://api.shopify.com/auth/partners.app.cli.access'])
    const accessToken = newToken[appId]!.accessToken
    const userId = nonRandomUUID(token)
    setLastSeenUserIdAfterAuth(userId)
    return {accessToken, userId}
  } catch (error) {
    throw new AbortError('The custom token provided is invalid.', 'Ensure the token is correct and not expired.')
  }
}

type IdentityDeviceError = 'authorization_pending' | 'access_denied' | 'expired_token' | 'slow_down' | 'unknown_failure'

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
  const value = tokenResult.mapError(tokenRequestErrorHandler).valueOrBug()
  const appToken = buildApplicationToken(value)
  return {[identifier]: appToken}
}

interface TokenRequestResult {
  access_token: string
  expires_in: number
  refresh_token: string
  scope: string
  id_token?: string
}

function tokenRequestErrorHandler(error: string) {
  const invalidTargetErrorMessage =
    'You are not authorized to use the CLI to develop in the provided store.' +
    '\n\n' +
    "You can't use Shopify CLI with development stores if you only have Partner " +
    'staff member access. If you want to use Shopify CLI to work on a development store, then ' +
    'you should be the store owner or create a staff account on the store.' +
    '\n\n' +
    "If you're the store owner, then you need to log in to the store directly using the " +
    'store URL at least once before you log in using Shopify CLI.' +
    'Logging in to the Shopify admin directly connects the development ' +
    'store with your Shopify login.'
  if (error === 'invalid_grant') {
    // There's an scenario when Identity returns "invalid_grant" when trying to refresh the token
    // using a valid refresh token. When that happens, we take the user through the authentication flow.
    return new InvalidGrantError()
  }
  if (error === 'invalid_request') {
    // There's an scenario when Identity returns "invalid_request" when exchanging an identity token.
    // This means the token is invalid. We clear the session and throw an error to let the caller know.
    return new InvalidRequestError()
  }
  if (error === 'invalid_target') {
    return new InvalidTargetError(invalidTargetErrorMessage)
  }
  // eslint-disable-next-line @shopify/cli/no-error-factory-functions
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

function buildIdentityToken(result: TokenRequestResult, existingUserId?: string): IdentityToken {
  const userId = existingUserId ?? (result.id_token ? jose.decodeJwt(result.id_token).sub! : undefined)

  if (!userId) {
    throw new BugError('Error setting userId for session. No id_token or pre-existing user ID provided.')
  }

  return {
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    expiresAt: new Date(Date.now() + result.expires_in * 1000),
    scopes: result.scope.split(' '),
    userId,
  }
}

function buildApplicationToken(result: TokenRequestResult): ApplicationToken {
  return {
    accessToken: result.access_token,
    expiresAt: new Date(Date.now() + result.expires_in * 1000),
    scopes: result.scope.split(' '),
  }
}
