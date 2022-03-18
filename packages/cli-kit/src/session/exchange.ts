import {ApplicationToken, IdentityToken} from './schema'
import {applicationId, clientId as getIdentityClientId} from './identity'
import {CodeAuthResult} from './authorize'
import {Abort} from '../error'
import {API} from '../network/api'
import {fetch} from '../http'
import {identity as identityFqdn} from '../environment/fqdn'

export interface ExchangeScopes {
  admin: string[]
  partners: string[]
  storefront: string[]
}
/**
 * Given a valid authorization code, request an identity access token.
 * This token can then be used to get API specific tokens.
 * @param codeData code and codeVerifier from the authorize endpoint
 * @param clientId
 * @param identityFqdn
 * @returns {Promise<IdentityToken>} An instance with the identity access tokens.
 */
export async function exchangeCodeForAccessToken(codeData: CodeAuthResult): Promise<IdentityToken> {
  const clientId = await getIdentityClientId()
  /* eslint-disable @typescript-eslint/naming-convention */
  const params = {
    grant_type: 'authorization_code',
    code: codeData.code,
    redirect_uri: 'http://127.0.0.1:3456',
    client_id: clientId,
    code_verifier: codeData.codeVerifier,
  }
  /* eslint-enable @typescript-eslint/naming-convention */

  return tokenRequest(params).then(buildIdentityToken)
}

/**
 * Given an identity token, request an application token.
 * @param token access token obtained in a previous step
 * @param store the store to use, only needed for admin API
 * @param clientId
 * @param identityFqdn
 * @returns {Promise<ApplicationSchema>} An array with the application access tokens.
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
 * @param currentToken
 * @returns
 */
export async function refreshAccessToken(currentToken: IdentityToken): Promise<IdentityToken> {
  const clientId = await getIdentityClientId()
  /* eslint-disable @typescript-eslint/naming-convention */
  const params = {
    grant_type: 'refresh_token',
    access_token: currentToken.accessToken,
    refresh_token: currentToken.refreshToken,
    client_id: clientId,
  }
  /* eslint-enable @typescript-eslint/naming-convention */

  return tokenRequest(params).then(buildIdentityToken)
}

/**
 * Given a custom CLI token passed as ENV variable, request a valid partners API token
 * This token does not accept extra scopes, just the cli one.
 * @param token {string} The CLI token passed as ENV variable
 * @returns {Promise<ApplicationToken>} An instance with the application access tokens.
 */
export async function exchangeCustomPartnerToken(token: string): Promise<ApplicationToken> {
  const appId = applicationId('partners')
  const newToken = await requestAppToken('partners', token, ['https://api.shopify.com/auth/partners.app.cli.access'])
  return newToken[appId]
}

async function requestAppToken(
  api: API,
  token: string,
  scopes: string[] = [],
  store?: string,
): Promise<{[x: string]: ApplicationToken}> {
  const appId = applicationId(api)
  const clientId = await getIdentityClientId()

  /* eslint-disable @typescript-eslint/naming-convention */
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
  /* eslint-enable @typescript-eslint/naming-convention */

  let identifier = appId
  if (api === 'admin' && store) {
    identifier = `${store}-${appId}`
  }
  const appToken = await tokenRequest(params).then(buildApplicationToken)
  return {[identifier]: appToken}
}

async function tokenRequest(params: {[key: string]: any}): Promise<unknown> {
  const fqdn = await identityFqdn()
  const url = new URL(`https://${fqdn}/oauth/token`)
  url.search = new URLSearchParams(Object.entries(params)).toString()

  const res = await fetch(url.href, {method: 'POST'})
  if (!res.ok) {
    throw new Abort(`HTTP ${res.status}`)
  }
  return res.json()
}

function buildIdentityToken(result: any): IdentityToken {
  return {
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    expiresAt: new Date(Date.now() + result.expires_in * 1000),
    scopes: result.scope.split(' '),
  }
}

function buildApplicationToken(result: any): ApplicationToken {
  return {
    accessToken: result.access_token,
    expiresAt: new Date(Date.now() + result.expires_in * 1000),
    scopes: result.scope.split(' '),
  }
}
