import {DEFAULT_STORE_AUTH_PORT, STORE_AUTH_APP_CLIENT_ID, STORE_AUTH_CALLBACK_PATH, maskToken, storeAuthRedirectUri} from './auth-config.js'
import {setStoredStoreAppSession} from './session.js'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {randomUUID} from '@shopify/cli-kit/node/crypto'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fetch} from '@shopify/cli-kit/node/http'
import {outputContent, outputDebug, outputToken} from '@shopify/cli-kit/node/output'
import {openURL} from '@shopify/cli-kit/node/system'
import {renderInfo, renderSuccess} from '@shopify/cli-kit/node/ui'
import {createHash, randomBytes, timingSafeEqual} from 'crypto'
import {createServer} from 'http'

interface StoreAuthInput {
  store: string
  scopes: string
}

interface StoreTokenResponse {
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

interface WaitForAuthCodeOptions {
  store: string
  state: string
  port: number
  timeoutMs?: number
  onListening?: () => void | Promise<void>
}

export function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url')
}

export function computeCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

export function parseStoreAuthScopes(input: string): string[] {
  const scopes = input
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean)

  if (scopes.length === 0) {
    throw new AbortError('At least one scope is required.', 'Pass --scopes as a comma-separated list.')
  }

  return [...new Set(scopes)]
}

function resolveGrantedScopes(tokenResponse: StoreTokenResponse, requestedScopes: string[]): string[] {
  if (!tokenResponse.scope) {
    outputDebug(outputContent`Token response did not include scope; falling back to requested scopes`)
    return requestedScopes
  }

  const grantedScopes = parseStoreAuthScopes(tokenResponse.scope)
  const missingScopes = requestedScopes.filter((scope) => !grantedScopes.includes(scope))

  if (missingScopes.length > 0) {
    throw new AbortError(
      'Shopify granted fewer scopes than were requested.',
      `Missing scopes: ${missingScopes.join(', ')}. Update the app or store installation scopes, then re-run shopify store auth.`,
    )
  }

  return grantedScopes
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

export async function waitForStoreAuthCode({
  store,
  state,
  port,
  timeoutMs = 5 * 60 * 1000,
  onListening,
}: WaitForAuthCodeOptions): Promise<string> {
  const normalizedStore = normalizeStoreFqdn(store)

  return new Promise<string>((resolve, reject) => {
    let settled = false
    let isListening = false

    const timeout = setTimeout(() => {
      settleWithError(new AbortError('Timed out waiting for OAuth callback.'))
    }, timeoutMs)

    const server = createServer((req, res) => {
      const requestUrl = new URL(req.url ?? '/', `http://127.0.0.1:${port}`)

      if (requestUrl.pathname !== STORE_AUTH_CALLBACK_PATH) {
        res.statusCode = 404
        res.end('Not found')
        return
      }

      const {searchParams} = requestUrl

      const fail = (message: string) => {
        res.statusCode = 400
        res.setHeader('Content-Type', 'text/html')
        res.setHeader('Connection', 'close')
        const safeMessage = message
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
        res.once('finish', () => settleWithError(new AbortError(message)))
        res.end(`<html><body><h1>Authentication failed</h1><p>${safeMessage}</p></body></html>`)
      }

      const returnedStore = searchParams.get('shop')
      outputDebug(outputContent`Received OAuth callback for shop ${outputToken.raw(returnedStore ?? 'unknown')}`)

      if (!returnedStore || normalizeStoreFqdn(returnedStore) !== normalizedStore) {
        fail('OAuth callback store does not match the requested store.')
        return
      }

      const returnedState = searchParams.get('state')
      if (!returnedState || !constantTimeEqual(returnedState, state)) {
        fail('OAuth callback state does not match the original request.')
        return
      }

      const error = searchParams.get('error')
      if (error) {
        fail(`Shopify returned an OAuth error: ${error}`)
        return
      }

      const code = searchParams.get('code')
      if (!code) {
        fail('OAuth callback did not include an authorization code.')
        return
      }

      outputDebug(outputContent`Received authorization code ${outputToken.raw(maskToken(code))}`)

      res.statusCode = 200
      res.setHeader('Content-Type', 'text/html')
      res.setHeader('Connection', 'close')
      res.once('finish', () => settle(() => resolve(code)))
      res.end('<html><body><h1>Authentication succeeded</h1><p>You can close this window and return to the terminal.</p></body></html>')
    })

    const settle = (callback: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)

      const finalize = () => {
        callback()
      }

      if (!isListening) {
        finalize()
        return
      }

      server.close(() => {
        isListening = false
        finalize()
      })
      server.closeIdleConnections?.()
    }

    const settleWithError = (error: Error) => {
      settle(() => reject(error))
    }

    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        settleWithError(
          new AbortError(
            `Port ${port} is already in use.`,
            `Free port ${port} and re-run ${outputToken.genericShellCommand(`shopify store auth --store ${store} --scopes <comma-separated-scopes>`).value}. Ensure that redirect URI is allowed in the app configuration.`,
          ),
        )
        return
      }

      settleWithError(error)
    })

    server.listen(port, '127.0.0.1', async () => {
      isListening = true
      outputDebug(
        outputContent`PKCE callback server listening on http://127.0.0.1:${outputToken.raw(String(port))}${outputToken.raw(STORE_AUTH_CALLBACK_PATH)}`,
      )

      if (!onListening) return

      try {
        await onListening()
      } catch (error) {
        settleWithError(error instanceof Error ? error : new Error(String(error)))
      }
    })
  })
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
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
      outputContent`Token exchange failed with HTTP ${outputToken.raw(String(response.status))}: ${outputToken.raw(body.slice(0, 300))}`,
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

interface StoreAuthDependencies {
  openURL: typeof openURL
  waitForStoreAuthCode: typeof waitForStoreAuthCode
  exchangeStoreAuthCodeForToken: typeof exchangeStoreAuthCodeForToken
  renderInfo: typeof renderInfo
  renderSuccess: typeof renderSuccess
}

const defaultStoreAuthDependencies: StoreAuthDependencies = {
  openURL,
  waitForStoreAuthCode,
  exchangeStoreAuthCodeForToken,
  renderInfo,
  renderSuccess,
}

function createPkceBootstrap(
  input: StoreAuthInput,
  exchangeCodeForToken: typeof exchangeStoreAuthCodeForToken,
): StoreAuthBootstrap {
  const store = normalizeStoreFqdn(input.store)
  const scopes = parseStoreAuthScopes(input.scopes)
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

export async function authenticateStoreWithApp(
  input: StoreAuthInput,
  dependencies: StoreAuthDependencies = defaultStoreAuthDependencies,
): Promise<void> {
  const bootstrap = createPkceBootstrap(input, dependencies.exchangeStoreAuthCodeForToken)
  const {
    authorization: {store, scopes, redirectUri, authorizationUrl},
  } = bootstrap

  dependencies.renderInfo({
    headline: 'Authenticate the app against your store.',
    body: [
      `Shopify CLI will open the app authorization page in your browser.`,
      `If the browser does not open, use this URL:`,
      {link: {label: authorizationUrl, url: authorizationUrl}},
      `Ensure your app allows the redirect URI ${redirectUri}.`,
    ],
  })

  const code = await dependencies.waitForStoreAuthCode({
    ...bootstrap.waitForAuthCodeOptions,
    onListening: async () => {
      await dependencies.openURL(authorizationUrl)
    },
  })
  const tokenResponse = await bootstrap.exchangeCodeForToken(code)

  const userId = tokenResponse.associated_user?.id?.toString()
  if (!userId) {
    throw new AbortError('Shopify did not return associated user information for the online access token.')
  }

  const now = Date.now()
  const expiresAt = tokenResponse.expires_in ? new Date(now + tokenResponse.expires_in * 1000).toISOString() : undefined

  setStoredStoreAppSession({
    store,
    clientId: STORE_AUTH_APP_CLIENT_ID,
    userId,
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    scopes: resolveGrantedScopes(tokenResponse, scopes),
    acquiredAt: new Date(now).toISOString(),
    expiresAt,
    refreshTokenExpiresAt: tokenResponse.refresh_token_expires_in
      ? new Date(now + tokenResponse.refresh_token_expires_in * 1000).toISOString()
      : undefined,
    associatedUser: tokenResponse.associated_user
      ? {
          id: tokenResponse.associated_user.id,
          email: tokenResponse.associated_user.email,
          firstName: tokenResponse.associated_user.first_name,
          lastName: tokenResponse.associated_user.last_name,
          accountOwner: tokenResponse.associated_user.account_owner,
        }
      : undefined,
  })

  outputDebug(
    outputContent`Session persisted for ${outputToken.raw(store)} (user ${outputToken.raw(userId)}, expires ${outputToken.raw(expiresAt ?? 'unknown')})`,
  )

  const email = tokenResponse.associated_user?.email
  const displayName = email ? ` as ${email}` : ''

  dependencies.renderSuccess({
    headline: 'Store authentication succeeded.',
    body: [
      `Authenticated${displayName} against ${store}.`,
      `Next step:`,
      {command: `shopify store execute --store ${store} --query 'query { shop { name id } }'`},
    ],
  })
}
