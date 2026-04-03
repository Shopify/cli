import {AbortError} from '@shopify/cli-kit/node/error'
import {fetch} from '@shopify/cli-kit/node/http'
import {outputContent, outputDebug, outputToken} from '@shopify/cli-kit/node/output'
import {maskToken, STORE_AUTH_APP_CLIENT_ID} from './config.js'

export interface StoreTokenResponse {
  access_token: string
  token_type?: string
  scope?: string
  expires_in?: number
  refresh_token?: string
  refresh_token_expires_in?: number
  associated_user_scope?: string
  associated_user?: {
    id: number
    first_name?: string
    last_name?: string
    email?: string
    account_owner?: boolean
    locale?: string
    collaborator?: boolean
    email_verified?: boolean
  }
}

interface StoreAccessScopesResponse {
  access_scopes?: {handle?: string}[]
}

interface StoreTokenRefreshPayload {
  accessToken: string
  refreshToken?: string
  expiresIn?: number
  refreshTokenExpiresIn?: number
}

function truncateHttpErrorBody(body: string, length = 300): string {
  return body.slice(0, length)
}

export async function exchangeStoreAuthCodeForToken(options: {
  store: string
  code: string
  codeVerifier: string
  redirectUri: string
}): Promise<StoreTokenResponse> {
  const endpoint = `https://${options.store}/admin/oauth/access_token`

  outputDebug(outputContent`Exchanging authorization code for token at ${outputToken.raw(endpoint)}`)

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      client_id: STORE_AUTH_APP_CLIENT_ID,
      code: options.code,
      code_verifier: options.codeVerifier,
      redirect_uri: options.redirectUri,
    }),
  })

  const body = await response.text()
  if (!response.ok) {
    outputDebug(
      outputContent`Token exchange failed with HTTP ${outputToken.raw(String(response.status))}: ${outputToken.raw(truncateHttpErrorBody(body || response.statusText))}`,
    )
    throw new AbortError(
      `Failed to exchange OAuth code for an access token (HTTP ${response.status}).`,
      body || response.statusText,
    )
  }

  let parsed: StoreTokenResponse
  try {
    parsed = JSON.parse(body) as StoreTokenResponse
  } catch {
    throw new AbortError('Received an invalid token response from Shopify.')
  }

  outputDebug(
    outputContent`Token exchange succeeded: access_token=${outputToken.raw(maskToken(parsed.access_token))}, refresh_token=${outputToken.raw(parsed.refresh_token ? maskToken(parsed.refresh_token) : 'none')}, expires_in=${outputToken.raw(String(parsed.expires_in ?? 'unknown'))}s, user=${outputToken.raw(String(parsed.associated_user?.id ?? 'unknown'))} (${outputToken.raw(parsed.associated_user?.email ?? 'no email')})`,
  )

  return parsed
}

export async function refreshStoreAccessToken(options: {
  store: string
  refreshToken: string
}): Promise<StoreTokenRefreshPayload> {
  const endpoint = `https://${options.store}/admin/oauth/access_token`

  outputDebug(
    outputContent`Refreshing access token for ${outputToken.raw(options.store)} using refresh_token=${outputToken.raw(maskToken(options.refreshToken))}`,
  )

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      client_id: STORE_AUTH_APP_CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: options.refreshToken,
    }),
  })

  const body = await response.text()
  if (!response.ok) {
    outputDebug(
      outputContent`Token refresh failed with HTTP ${outputToken.raw(String(response.status))}: ${outputToken.raw(truncateHttpErrorBody(body || response.statusText))}`,
    )
    throw new AbortError(`Token refresh failed for ${options.store} (HTTP ${response.status}).`)
  }

  let parsed: StoreTokenResponse
  try {
    parsed = JSON.parse(body) as StoreTokenResponse
  } catch {
    throw new AbortError('Received an invalid refresh response from Shopify.')
  }

  if (!parsed.access_token) {
    throw new AbortError(`Token refresh returned an invalid response for ${options.store}.`)
  }

  return {
    accessToken: parsed.access_token,
    refreshToken: parsed.refresh_token,
    expiresIn: parsed.expires_in,
    refreshTokenExpiresIn: parsed.refresh_token_expires_in,
  }
}

export async function fetchCurrentStoreAuthScopes(options: {
  store: string
  accessToken: string
}): Promise<string[]> {
  const endpoint = `https://${options.store}/admin/oauth/access_scopes.json`

  outputDebug(
    outputContent`Fetching current app installation scopes for ${outputToken.raw(options.store)} using token ${outputToken.raw(maskToken(options.accessToken))}`,
  )

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': options.accessToken,
    },
  })

  const body = await response.text()
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${truncateHttpErrorBody(body || response.statusText)}`)
  }

  let parsed: StoreAccessScopesResponse
  try {
    parsed = JSON.parse(body) as StoreAccessScopesResponse
  } catch {
    throw new Error('Received an invalid access scopes response from Shopify.')
  }

  if (!Array.isArray(parsed.access_scopes)) {
    throw new Error('Shopify did not return access_scopes.')
  }

  return parsed.access_scopes.flatMap((scope) => (typeof scope.handle === 'string' ? [scope.handle] : []))
}
