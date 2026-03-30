import {DEFAULT_STORE_AUTH_PORT, STORE_AUTH_APP_CLIENT_ID, STORE_AUTH_CALLBACK_PATH, storeAuthRedirectUri} from './config.js'
import {setStoredStoreAppSession} from './session.js'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {randomUUID} from '@shopify/cli-kit/node/crypto'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExists, readFile} from '@shopify/cli-kit/node/fs'
import {fetch} from '@shopify/cli-kit/node/http'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'
import {openURL} from '@shopify/cli-kit/node/system'
import {renderInfo, renderSuccess} from '@shopify/cli-kit/node/ui'
import {createHmac, timingSafeEqual} from 'crypto'
import {createServer} from 'http'

interface StoreAuthInput {
  store: string
  scopes: string
  clientSecretFile: string
  port?: number
}

interface StoreTokenResponse {
  access_token: string
  scope?: string
  associated_user_scope?: string
}

export interface WaitForAuthCodeOptions {
  store: string
  state: string
  clientSecret: string
  port: number
  timeoutMs?: number
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

export function buildStoreAuthUrl(options: {
  store: string
  scopes: string[]
  state: string
  redirectUri: string
}): string {
  const params = new URLSearchParams()
  params.set('client_id', STORE_AUTH_APP_CLIENT_ID)
  params.set('scope', options.scopes.join(','))
  params.set('redirect_uri', options.redirectUri)
  params.set('state', options.state)
  params.append('grant_options[]', 'per-user')

  return `https://${options.store}/admin/oauth/authorize?${params.toString()}`
}

export function verifyStoreAuthHmac(params: URLSearchParams, clientSecret: string): boolean {
  const providedHmac = params.get('hmac')
  if (!providedHmac) return false

  const entries = [...params.entries()]
    .filter(([key]) => key !== 'hmac' && key !== 'signature')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)

  const message = entries.join('&')
  const digest = createHmac('sha256', clientSecret).update(message).digest('hex')
  if (digest.length !== providedHmac.length) return false

  return timingSafeEqual(Buffer.from(digest, 'utf8'), Buffer.from(providedHmac, 'utf8'))
}

export async function waitForStoreAuthCode({
  store,
  state,
  clientSecret,
  port,
  timeoutMs = 5 * 60 * 1000,
}: WaitForAuthCodeOptions): Promise<string> {
  const normalizedStore = normalizeStoreFqdn(store)

  return new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      const requestUrl = new URL(req.url ?? '/', `http://localhost:${port}`)

      if (requestUrl.pathname !== STORE_AUTH_CALLBACK_PATH) {
        res.statusCode = 404
        res.end('Not found')
        return
      }

      const {searchParams} = requestUrl

      const fail = (message: string) => {
        res.statusCode = 400
        res.setHeader('Content-Type', 'text/html')
        res.end(`<html><body><h1>Authentication failed</h1><p>${message}</p></body></html>`)
        server.close(() => reject(new AbortError(message)))
      }

      const returnedStore = searchParams.get('shop')
      if (!returnedStore || normalizeStoreFqdn(returnedStore) !== normalizedStore) {
        fail('OAuth callback store does not match the requested store.')
        return
      }

      if (searchParams.get('state') !== state) {
        fail('OAuth callback state does not match the original request.')
        return
      }

      if (!verifyStoreAuthHmac(searchParams, clientSecret)) {
        fail('OAuth callback could not be verified.')
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

      res.statusCode = 200
      res.setHeader('Content-Type', 'text/html')
      res.end('<html><body><h1>Authentication succeeded</h1><p>You can close this window and return to the terminal.</p></body></html>')
      server.close(() => resolve(code))
    })

    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        reject(
          new AbortError(
            `Port ${port} is already in use.`,
            `Re-run ${outputToken.genericShellCommand('shopify store auth --port <value>').value} with a free port and ensure that redirect URI is allowed in the app configuration.`,
          ),
        )
        return
      }

      reject(error)
    })

    const timeout = setTimeout(() => {
      server.close(() => reject(new AbortError('Timed out waiting for OAuth callback.')))
    }, timeoutMs)

    server.listen(port, 'localhost', () => {
      clearTimeout(timeout)
      const activeTimeout = setTimeout(() => {
        server.close(() => reject(new AbortError('Timed out waiting for OAuth callback.')))
      }, timeoutMs)
      server.on('close', () => clearTimeout(activeTimeout))
    })
  })
}

export async function exchangeStoreAuthCodeForToken(options: {
  store: string
  code: string
  clientSecret: string
}): Promise<StoreTokenResponse> {
  const response = await fetch(`https://${options.store}/admin/oauth/access_token`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      client_id: STORE_AUTH_APP_CLIENT_ID,
      client_secret: options.clientSecret,
      code: options.code,
    }),
  })

  const body = await response.text()
  if (!response.ok) {
    throw new AbortError(
      `Failed to exchange OAuth code for an access token (HTTP ${response.status}).`,
      body || response.statusText,
    )
  }

  try {
    return JSON.parse(body) as StoreTokenResponse
  } catch {
    throw new AbortError('Received an invalid token response from Shopify.')
  }
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

async function readClientSecretFromFile(path: string): Promise<string> {
  if (!(await fileExists(path))) {
    throw new AbortError(
      outputContent`Client secret file not found at ${outputToken.path(path)}. Please check the path and try again.`,
    )
  }

  const contents = await readFile(path, {encoding: 'utf8'})
  const secret = contents.trim()
  if (!secret) {
    throw new AbortError(
      outputContent`Client secret file at ${outputToken.path(path)} is empty. Please provide a valid client secret.`,
    )
  }

  return secret
}

export async function authenticateStoreWithApp(
  input: StoreAuthInput,
  dependencies: StoreAuthDependencies = defaultStoreAuthDependencies,
): Promise<void> {
  const store = normalizeStoreFqdn(input.store)
  const scopes = parseStoreAuthScopes(input.scopes)
  const port = input.port ?? DEFAULT_STORE_AUTH_PORT
  const clientSecret = await readClientSecretFromFile(input.clientSecretFile)
  const state = randomUUID()
  const redirectUri = storeAuthRedirectUri(port)
  const authorizationUrl = buildStoreAuthUrl({store, scopes, state, redirectUri})

  dependencies.renderInfo({
    headline: 'Authenticate the app against your store.',
    body: [
      `Shopify CLI will open the app authorization page in your browser.`,
      `If the browser does not open, use this URL:`,
      {link: {label: authorizationUrl, url: authorizationUrl}},
      `Ensure your app allows the redirect URI ${redirectUri}.`,
    ],
  })

  void dependencies.openURL(authorizationUrl)

  const code = await dependencies.waitForStoreAuthCode({store, state, clientSecret, port})
  const tokenResponse = await dependencies.exchangeStoreAuthCodeForToken({store, code, clientSecret})

  setStoredStoreAppSession({
    store,
    clientId: STORE_AUTH_APP_CLIENT_ID,
    accessToken: tokenResponse.access_token,
    scopes,
    associatedUserScope: tokenResponse.associated_user_scope,
    acquiredAt: new Date().toISOString(),
  })

  dependencies.renderSuccess({
    headline: 'Store authentication succeeded.',
    body: [
      `The app is now authenticated against ${store}.`,
      `Next step:`,
      {command: `shopify store execute --store ${store} --query 'query { shop { name id } }'`},
    ],
  })
}
