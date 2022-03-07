import {Abort} from '../error'
import {API} from '../network/api'
import {fetch} from '../http'
import {identity} from '../environment/fqdn'

import {ApplicationToken, IdentityToken} from './schema'
import {
  applicationId,
  defaultScopes,
  clientId as getIdentityClientId,
} from './identity'
import {CodeAuthResult} from './authorize'

/**
 * Given a valid authorization code, request an identity access token.
 * This token can then be used to get API specific tokens.
 * @param codeData code and codeVerifier from the authorize endpoint
 * @param clientId
 * @param identityFqdn
 * @returns {Promise<IdentityToken>} An instance with the identity access tokens.
 */
export async function exchangeCodeForAccessToken(
  codeData: CodeAuthResult,
): Promise<IdentityToken> {
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
  store?: string,
): Promise<{[x: string]: ApplicationToken}> {
  const token = identityToken.accessToken

  const partners = await requestApplicationToken('partners', token)
  const storefront = await requestApplicationToken('storefront-renderer', token)

  const result = {
    ...partners,
    ...storefront,
  }

  if (store) {
    const admin = await requestApplicationToken('admin', token, store)
    Object.assign(result, admin)
  }
  return result
}

async function requestApplicationToken(
  api: API,
  token: string,
  store?: string,
): Promise<{[x: string]: ApplicationToken}> {
  const scopes = defaultScopes(api)
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
  const fqdn = await identity()
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
