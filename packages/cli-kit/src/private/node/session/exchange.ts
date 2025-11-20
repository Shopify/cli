import {ApplicationToken, IdentityToken} from './schema.js'
import {tokenExchangeScopes} from './scopes.js'
import {API} from '../api.js'
import {err, ok, Result} from '../../../public/node/result.js'
import {AbortError, BugError, ExtendableError} from '../../../public/node/error.js'
import {setLastSeenAuthMethod, setLastSeenUserIdAfterAuth} from '../session.js'
import {nonRandomUUID} from '../../../public/node/crypto.js'
import {getIdentityClient} from '../clients/identity/instance.js'
import * as jose from 'jose'

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

  const [partners, storefront, businessPlatform, admin, appManagement] = await Promise.all([
    requestAppToken('partners', token, scopes.partners),
    requestAppToken('storefront-renderer', token, scopes.storefront),
    requestAppToken('business-platform', token, scopes.businessPlatform),
    store ? requestAppToken('admin', token, scopes.admin, store) : {},
    requestAppToken('app-management', token, scopes.appManagement),
  ])

  return {
    ...partners,
    ...storefront,
    ...businessPlatform,
    ...admin,
    ...appManagement,
  }
}

export async function refreshAccessToken(currentToken: IdentityToken): Promise<IdentityToken> {
  const clientId = getIdentityClient().clientId()
  const params = {
    grant_type: 'refresh_token',
    access_token: currentToken.accessToken,
    refresh_token: currentToken.refreshToken,
    client_id: clientId,
  }
  const tokenResult = await getIdentityClient().tokenRequest(params)
  const value = tokenResult.mapError(tokenRequestErrorHandler).valueOrBug()
  return buildIdentityToken(value, currentToken.userId, currentToken.alias)
}

/**
 * Given a custom CLI token passed as ENV variable  request a valid API access token
 * @param token - The CLI token passed as ENV variable `SHOPIFY_CLI_PARTNERS_TOKEN`
 * @param apiName - The API to exchange for the access token
 * @param scopes - The scopes to request with the access token
 * @returns An instance with the application access tokens.
 */
async function exchangeCliTokenForAccessToken(
  apiName: API,
  token: string,
  scopes: string[],
): Promise<{accessToken: string; userId: string}> {
  const appId = getIdentityClient().applicationId(apiName)
  try {
    const newToken = await requestAppToken(apiName, token, scopes)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const accessToken = newToken[appId]!.accessToken
    const userId = nonRandomUUID(token)
    setLastSeenUserIdAfterAuth(userId)
    setLastSeenAuthMethod('partners_token')
    return {accessToken, userId}
  } catch (error) {
    const prettyName = apiName.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
    throw new AbortError(
      `The custom token provided can't be used for the ${prettyName} API.`,
      'Ensure the token is correct and not expired.',
    )
  }
}

/**
 * Given a custom CLI token passed as ENV variable, request a valid Partners API token
 * This token does not accept extra scopes, just the cli one.
 * @param token - The CLI token passed as ENV variable `SHOPIFY_CLI_PARTNERS_TOKEN`
 * @returns An instance with the application access tokens.
 */
export async function exchangeCustomPartnerToken(token: string): Promise<{accessToken: string; userId: string}> {
  return exchangeCliTokenForAccessToken('partners', token, tokenExchangeScopes('partners'))
}

/**
 * Given a custom CLI token passed as ENV variable, request a valid App Management API token
 * @param token - The CLI token passed as ENV variable `SHOPIFY_CLI_PARTNERS_TOKEN`
 * @returns An instance with the application access tokens.
 */
export async function exchangeCliTokenForAppManagementAccessToken(
  token: string,
): Promise<{accessToken: string; userId: string}> {
  return exchangeCliTokenForAccessToken('app-management', token, tokenExchangeScopes('app-management'))
}

/**
 * Given a custom CLI token passed as ENV variable, request a valid Business Platform API token
 * @param token - The CLI token passed as ENV variable `SHOPIFY_CLI_PARTNERS_TOKEN`
 * @returns An instance with the application access tokens.
 */
export async function exchangeCliTokenForBusinessPlatformAccessToken(
  token: string,
): Promise<{accessToken: string; userId: string}> {
  return exchangeCliTokenForAccessToken('business-platform', token, tokenExchangeScopes('business-platform'))
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
  const clientId = getIdentityClient().clientId()

  const params = {
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    device_code: deviceCode,
    client_id: clientId,
  }

  const tokenResult = await getIdentityClient().tokenRequest(params)
  if (tokenResult.isErr()) {
    return err(tokenResult.error.error as IdentityDeviceError)
  }
  const identityToken = buildIdentityToken(tokenResult.value)
  return ok(identityToken)
}

export async function requestAppToken(
  api: API,
  token: string,
  scopes: string[] = [],
  store?: string,
): Promise<{[x: string]: ApplicationToken}> {
  const identityClient = getIdentityClient()
  const appId = identityClient.applicationId(api)

  const params = {
    grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
    requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
    subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
    client_id: identityClient.clientId(),
    audience: appId,
    scope: scopes.join(' '),
    subject_token: token,
    ...(api === 'admin' && {destination: `https://${store}/admin`, store}),
  }

  let identifier = appId
  if (api === 'admin' && store) {
    identifier = `${store}-${appId}`
  }
  const tokenResult = await getIdentityClient().tokenRequest(params)
  const value = tokenResult.mapError(tokenRequestErrorHandler).valueOrBug()
  const appToken = buildApplicationToken(value)
  return {[identifier]: appToken}
}

export interface TokenRequestResult {
  access_token: string
  expires_in: number
  refresh_token: string
  scope: string
  id_token?: string
}

export function tokenRequestErrorHandler({error, store}: {error: string; store?: string}) {
  const invalidTargetErrorMessage = `You are not authorized to use the CLI to develop in the provided store${
    store ? `: ${store}` : '.'
  }`

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
    return new InvalidTargetError(invalidTargetErrorMessage, '', [
      'Ensure you have logged in to the store using the Shopify admin at least once.',
      'Ensure you are the store owner, or have a staff account if you are attempting to log in to a dev store.',
      'Ensure you are using the permanent store domain, not a vanity domain.',
    ])
  }
  // eslint-disable-next-line @shopify/cli/no-error-factory-functions
  return new AbortError(error)
}

export function buildIdentityToken(
  result: TokenRequestResult,
  existingUserId?: string,
  existingAlias?: string,
): IdentityToken {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
    alias: existingAlias,
  }
}

function buildApplicationToken(result: TokenRequestResult): ApplicationToken {
  return {
    accessToken: result.access_token,
    expiresAt: new Date(Date.now() + result.expires_in * 1000),
    scopes: result.scope.split(' '),
  }
}
