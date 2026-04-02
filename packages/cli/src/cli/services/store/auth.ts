import {DEFAULT_STORE_AUTH_PORT, STORE_AUTH_APP_CLIENT_ID, STORE_AUTH_CALLBACK_PATH, maskToken, storeAuthRedirectUri} from './auth-config.js'
import {retryStoreAuthWithPermanentDomainError} from './auth-recovery.js'
import {getStoredStoreAppSession, setStoredStoreAppSession} from './session.js'
import type {StoredStoreAppSession} from './session.js'
import {loadStoredStoreSession} from './stored-session.js'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {randomUUID} from '@shopify/cli-kit/node/crypto'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fetch} from '@shopify/cli-kit/node/http'
import {outputCompleted, outputContent, outputDebug, outputInfo, outputToken} from '@shopify/cli-kit/node/output'
import {openURL} from '@shopify/cli-kit/node/system'
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

function expandImpliedStoreScopes(scopes: string[]): Set<string> {
  const expandedScopes = new Set(scopes)

  for (const scope of scopes) {
    const matches = scope.match(/^(unauthenticated_)?write_(.*)$/)
    if (matches) {
      expandedScopes.add(`${matches[1] ?? ''}read_${matches[2]}`)
    }
  }

  return expandedScopes
}

function mergeRequestedAndStoredScopes(requestedScopes: string[], storedScopes: string[]): string[] {
  const mergedScopes = [...storedScopes]
  const expandedScopes = expandImpliedStoreScopes(storedScopes)

  for (const scope of requestedScopes) {
    if (expandedScopes.has(scope)) continue

    mergedScopes.push(scope)
    for (const expandedScope of expandImpliedStoreScopes([scope])) {
      expandedScopes.add(expandedScope)
    }
  }

  return mergedScopes
}

interface StoreAccessScopesResponse {
  access_scopes?: {handle?: string}[]
}

interface ResolvedStoreAuthScopes {
  scopes: string[]
  authoritative: boolean
}

async function fetchCurrentStoreAuthScopes(session: StoredStoreAppSession): Promise<string[]> {
  const endpoint = `https://${session.store}/admin/oauth/access_scopes.json`

  outputDebug(
    outputContent`Fetching current app installation scopes for ${outputToken.raw(session.store)} using token ${outputToken.raw(maskToken(session.accessToken))}`,
  )

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': session.accessToken,
    },
  })

  const body = await response.text()
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${body || response.statusText}`)
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

export async function resolveExistingStoreAuthScopes(store: string): Promise<ResolvedStoreAuthScopes> {
  const normalizedStore = normalizeStoreFqdn(store)
  const storedSession = getStoredStoreAppSession(normalizedStore)
  if (!storedSession) return {scopes: [], authoritative: true}

  try {
    const usableSession = await loadStoredStoreSession(normalizedStore)
    const remoteScopes = await fetchCurrentStoreAuthScopes(usableSession)

    outputDebug(
      outputContent`Resolved current remote scopes for ${outputToken.raw(normalizedStore)}: ${outputToken.raw(remoteScopes.join(',') || 'none')}`,
    )

    return {scopes: remoteScopes, authoritative: true}
  } catch (error) {
    outputDebug(
      outputContent`Falling back to locally stored scopes for ${outputToken.raw(normalizedStore)} after remote scope lookup failed: ${outputToken.raw(error instanceof Error ? error.message : String(error))}`,
    )
    return {scopes: storedSession.scopes, authoritative: false}
  }
}

function resolveGrantedScopes(tokenResponse: StoreTokenResponse, requestedScopes: string[]): string[] {
  if (!tokenResponse.scope) {
    outputDebug(outputContent`Token response did not include scope; falling back to requested scopes`)
    return requestedScopes
  }

  const grantedScopes = parseStoreAuthScopes(tokenResponse.scope)
  const expandedGrantedScopes = expandImpliedStoreScopes(grantedScopes)
  const missingScopes = requestedScopes.filter((scope) => !expandedGrantedScopes.has(scope))

  if (missingScopes.length > 0) {
    throw new AbortError(
      'Shopify granted fewer scopes than were requested.',
      `Missing scopes: ${missingScopes.join(', ')}.`,
      [
        'Update the app or store installation scopes.',
        'See https://shopify.dev/app/scopes',
        'Re-run shopify store auth.',
      ],
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

function renderAuthCallbackPage(title: string, message: string): string {
  const safeTitle = title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  const safeMessage = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;background:#f6f6f7;color:#202223;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <main style="max-width:32rem;margin:12vh auto;padding:0 1rem;">
      <section style="background:#fff;border:1px solid #e1e3e5;border-radius:12px;padding:1.5rem 1.25rem;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <h1 style="margin:0 0 0.75rem 0;font-size:1.375rem;line-height:1.2;">${safeTitle}</h1>
        <p style="margin:0;font-size:1rem;line-height:1.5;">${safeMessage}</p>
      </section>
    </main>
  </body>
</html>`
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

      const fail = (error: AbortError | string, tryMessage?: string) => {
        const abortError = typeof error === 'string' ? new AbortError(error, tryMessage) : error

        res.statusCode = 400
        res.setHeader('Content-Type', 'text/html')
        res.setHeader('Connection', 'close')
        res.once('finish', () => settleWithError(abortError))
        res.end(renderAuthCallbackPage('Authentication failed', abortError.message))
      }

      const returnedStore = searchParams.get('shop')
      outputDebug(outputContent`Received OAuth callback for shop ${outputToken.raw(returnedStore ?? 'unknown')}`)

      if (!returnedStore) {
        fail('OAuth callback store does not match the requested store.')
        return
      }

      const normalizedReturnedStore = normalizeStoreFqdn(returnedStore)
      if (normalizedReturnedStore !== normalizedStore) {
        fail(retryStoreAuthWithPermanentDomainError(normalizedReturnedStore))
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
      res.end(renderAuthCallbackPage('Authentication succeeded', 'You can close this window and return to the terminal.'))
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

interface StoreAuthPresenter {
  openingBrowser: () => void
  manualAuthUrl: (authorizationUrl: string) => void
  success: (store: string, email?: string) => void
}

interface StoreAuthDependencies {
  openURL: typeof openURL
  waitForStoreAuthCode: typeof waitForStoreAuthCode
  exchangeStoreAuthCodeForToken: typeof exchangeStoreAuthCodeForToken
  resolveExistingScopes?: (store: string) => Promise<ResolvedStoreAuthScopes>
  presenter: StoreAuthPresenter
}

const defaultStoreAuthPresenter: StoreAuthPresenter = {
  openingBrowser() {
    outputInfo('Shopify CLI will open the app authorization page in your browser.')
    outputInfo('')
  },
  manualAuthUrl(authorizationUrl: string) {
    outputInfo('Browser did not open automatically. Open this URL manually:')
    outputInfo(outputContent`${outputToken.link(authorizationUrl)}`)
    outputInfo('')
  },
  success(store: string, email?: string) {
    const displayName = email ? ` as ${email}` : ''

    outputCompleted('Logged in.')
    outputCompleted(`Authenticated${displayName} against ${store}.`)
    outputInfo('')
    outputInfo('To verify that authentication worked, run:')
    outputInfo(`shopify store execute --store ${store} --query 'query { shop { name id } }'`)
  },
}

const defaultStoreAuthDependencies: StoreAuthDependencies = {
  openURL,
  waitForStoreAuthCode,
  exchangeStoreAuthCodeForToken,
  presenter: defaultStoreAuthPresenter,
}

function createPkceBootstrap(options: {
  store: string
  scopes: string[]
  exchangeCodeForToken: typeof exchangeStoreAuthCodeForToken
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

export async function authenticateStoreWithApp(
  input: StoreAuthInput,
  dependencies: StoreAuthDependencies = defaultStoreAuthDependencies,
): Promise<void> {
  const store = normalizeStoreFqdn(input.store)
  const requestedScopes = parseStoreAuthScopes(input.scopes)
  const existingScopeResolution = await (dependencies.resolveExistingScopes ?? resolveExistingStoreAuthScopes)(store)
  const scopes = mergeRequestedAndStoredScopes(requestedScopes, existingScopeResolution.scopes)
  const validationScopes = existingScopeResolution.authoritative ? scopes : requestedScopes

  if (existingScopeResolution.scopes.length > 0) {
    outputDebug(
      outputContent`Merged requested scopes ${outputToken.raw(requestedScopes.join(','))} with existing scopes ${outputToken.raw(existingScopeResolution.scopes.join(','))} for ${outputToken.raw(store)}`,
    )
  }

  const bootstrap = createPkceBootstrap({store, scopes, exchangeCodeForToken: dependencies.exchangeStoreAuthCodeForToken})
  const {authorization: {authorizationUrl}} = bootstrap

  dependencies.presenter.openingBrowser()

  const code = await dependencies.waitForStoreAuthCode({
    ...bootstrap.waitForAuthCodeOptions,
    onListening: async () => {
      const opened = await dependencies.openURL(authorizationUrl)
      if (!opened) dependencies.presenter.manualAuthUrl(authorizationUrl)
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
    // Store the raw scopes returned by Shopify. Validation may treat implied
    // write_* -> read_* permissions as satisfied, so callers should not assume
    // session.scopes is an expanded/effective permission set.
    scopes: resolveGrantedScopes(tokenResponse, validationScopes),
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

  dependencies.presenter.success(store, tokenResponse.associated_user?.email)
}
