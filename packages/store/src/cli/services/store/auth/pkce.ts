import {DEFAULT_STORE_AUTH_PORT, STORE_AUTH_APP_CLIENT_ID, storeAuthRedirectUri} from './config.js'
import {randomUUID} from '@shopify/cli-kit/node/crypto'
import {outputContent, outputDebug, outputToken} from '@shopify/cli-kit/node/output'
import {createHash, randomBytes} from 'crypto'
import type {StoreTokenResponse} from './token-client.js'
import type {WaitForAuthCodeOptions} from './callback.js'

interface StoreAuthorizationContext {
  store: string
  scopes: string[]
  state: string
  port: number
  redirectUri: string
  authorizationUrl: string
  codeVerifier: string
}

interface StoreAuthBootstrap {
  authorization: StoreAuthorizationContext
  waitForAuthCodeOptions: WaitForAuthCodeOptions
  exchangeCodeForToken: (code: string) => Promise<StoreTokenResponse>
}

export function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url')
}

export function computeCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

export function buildStoreAuthUrl(options: {
  store: string
  scopes: string[]
  state: string
  redirectUri: string
  codeChallenge: string
}): string {
  const params = new URLSearchParams()
  params.set('client_id', STORE_AUTH_APP_CLIENT_ID)
  params.set('scope', options.scopes.join(','))
  params.set('redirect_uri', options.redirectUri)
  params.set('state', options.state)
  params.set('response_type', 'code')
  params.set('code_challenge', options.codeChallenge)
  params.set('code_challenge_method', 'S256')

  return `https://${options.store}/admin/oauth/authorize?${params.toString()}`
}

export function createPkceBootstrap(options: {
  store: string
  scopes: string[]
  exchangeCodeForToken: (options: {
    store: string
    code: string
    codeVerifier: string
    redirectUri: string
  }) => Promise<StoreTokenResponse>
}): StoreAuthBootstrap {
  const {store, scopes, exchangeCodeForToken} = options
  const port = DEFAULT_STORE_AUTH_PORT
  const state = randomUUID()
  const redirectUri = storeAuthRedirectUri(port)
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = computeCodeChallenge(codeVerifier)
  const authorizationUrl = buildStoreAuthUrl({store, scopes, state, redirectUri, codeChallenge})

  outputDebug(
    outputContent`Starting PKCE auth for ${outputToken.raw(store)} with scopes ${outputToken.raw(scopes.join(','))} (redirect_uri=${outputToken.raw(redirectUri)})`,
  )

  return {
    authorization: {
      store,
      scopes,
      state,
      port,
      redirectUri,
      authorizationUrl,
      codeVerifier,
    },
    waitForAuthCodeOptions: {
      store,
      state,
      port,
    },
    exchangeCodeForToken: (code: string) => exchangeCodeForToken({store, code, codeVerifier, redirectUri}),
  }
}
