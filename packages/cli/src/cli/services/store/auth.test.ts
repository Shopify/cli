import {createServer} from 'http'
import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest'
import {
  authenticateStoreWithApp,
  buildStoreAuthUrl,
  parseStoreAuthScopes,
  generateCodeVerifier,
  computeCodeChallenge,
  exchangeStoreAuthCodeForToken,
  waitForStoreAuthCode,
} from './auth.js'
import {setStoredStoreAppSession} from './session.js'
import {STORE_AUTH_APP_CLIENT_ID} from './auth-config.js'
import {fetch} from '@shopify/cli-kit/node/http'

vi.mock('./session.js')
vi.mock('@shopify/cli-kit/node/http')
vi.mock('@shopify/cli-kit/node/system', () => ({openURL: vi.fn().mockResolvedValue(true)}))
vi.mock('@shopify/cli-kit/node/crypto', () => ({randomUUID: vi.fn().mockReturnValue('state-123')}))

async function getAvailablePort(): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const server = createServer()

    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        reject(new Error('Expected an ephemeral port.'))
        return
      }

      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve(address.port)
      })
    })
  })
}

function callbackParams(options?: {
  code?: string
  shop?: string
  state?: string
  error?: string
}): URLSearchParams {
  const params = new URLSearchParams()
  params.set('shop', options?.shop ?? 'shop.myshopify.com')
  params.set('state', options?.state ?? 'state-123')

  if (options?.code) params.set('code', options.code)
  if (options?.error) params.set('error', options.error)
  if (!options?.code && !options?.error) params.set('code', 'abc123')

  return params
}

describe('store auth service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('generateCodeVerifier produces a base64url string of 43 chars', () => {
    const verifier = generateCodeVerifier()
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  test('generateCodeVerifier produces unique values', () => {
    const a = generateCodeVerifier()
    const b = generateCodeVerifier()
    expect(a).not.toBe(b)
  })

  test('computeCodeChallenge produces a deterministic S256 hash', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
    const expected = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
    expect(computeCodeChallenge(verifier)).toBe(expected)
  })

  test('parseStoreAuthScopes splits and deduplicates scopes', () => {
    expect(parseStoreAuthScopes('read_products, write_products,read_products')).toEqual([
      'read_products',
      'write_products',
    ])
  })

  test('buildStoreAuthUrl includes PKCE params and response_type=code', () => {
    const url = new URL(
      buildStoreAuthUrl({
        store: 'shop.myshopify.com',
        scopes: ['read_products', 'write_products'],
        state: 'state-123',
        redirectUri: 'http://127.0.0.1:13387/auth/callback',
        codeChallenge: 'test-challenge-value',
      }),
    )

    expect(url.hostname).toBe('shop.myshopify.com')
    expect(url.pathname).toBe('/admin/oauth/authorize')
    expect(url.searchParams.get('client_id')).toBe(STORE_AUTH_APP_CLIENT_ID)
    expect(url.searchParams.get('scope')).toBe('read_products,write_products')
    expect(url.searchParams.get('state')).toBe('state-123')
    expect(url.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:13387/auth/callback')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('code_challenge')).toBe('test-challenge-value')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('grant_options[]')).toBeNull()
  })

  test('waitForStoreAuthCode resolves after a valid callback', async () => {
    const port = await getAvailablePort()
    const params = callbackParams()
    const onListening = vi.fn(async () => {
      const response = await globalThis.fetch(`http://127.0.0.1:${port}/auth/callback?${params.toString()}`)
      expect(response.status).toBe(200)
      await response.text()
    })

    await expect(
      waitForStoreAuthCode({
        store: 'shop.myshopify.com',
        state: 'state-123',
        port,
        timeoutMs: 1000,
        onListening,
      }),
    ).resolves.toBe('abc123')

    expect(onListening).toHaveBeenCalledOnce()
  })

  test('waitForStoreAuthCode rejects when callback state does not match', async () => {
    const port = await getAvailablePort()
    const params = callbackParams({state: 'wrong-state'})

    await expect(
      waitForStoreAuthCode({
        store: 'shop.myshopify.com',
        state: 'state-123',
        port,
        timeoutMs: 1000,
        onListening: async () => {
          const response = await globalThis.fetch(`http://127.0.0.1:${port}/auth/callback?${params.toString()}`)
          expect(response.status).toBe(400)
          await response.text()
        },
      }),
    ).rejects.toThrow('OAuth callback state does not match the original request.')
  })

  test('waitForStoreAuthCode rejects when callback store does not match and suggests the returned permanent domain', async () => {
    const port = await getAvailablePort()
    const params = callbackParams({shop: 'other-shop.myshopify.com'})

    await expect(
      waitForStoreAuthCode({
        store: 'shop.myshopify.com',
        state: 'state-123',
        port,
        timeoutMs: 1000,
        onListening: async () => {
          const response = await globalThis.fetch(`http://127.0.0.1:${port}/auth/callback?${params.toString()}`)
          expect(response.status).toBe(400)
          await response.text()
        },
      }),
    ).rejects.toMatchObject({
      message: 'OAuth callback store does not match the requested store.',
      tryMessage:
        'Shopify returned other-shop.myshopify.com during authentication. Re-run shopify store auth --store other-shop.myshopify.com --scopes <comma-separated-scopes> using the permanent store domain instead of an alias or vanity domain.',
    })
  })

  test('waitForStoreAuthCode rejects when Shopify returns an OAuth error', async () => {
    const port = await getAvailablePort()
    const params = callbackParams({error: 'access_denied'})

    await expect(
      waitForStoreAuthCode({
        store: 'shop.myshopify.com',
        state: 'state-123',
        port,
        timeoutMs: 1000,
        onListening: async () => {
          const response = await globalThis.fetch(`http://127.0.0.1:${port}/auth/callback?${params.toString()}`)
          expect(response.status).toBe(400)
          await response.text()
        },
      }),
    ).rejects.toThrow('Shopify returned an OAuth error: access_denied')
  })

  test('waitForStoreAuthCode rejects when callback does not include an authorization code', async () => {
    const port = await getAvailablePort()
    const params = callbackParams()
    params.delete('code')

    await expect(
      waitForStoreAuthCode({
        store: 'shop.myshopify.com',
        state: 'state-123',
        port,
        timeoutMs: 1000,
        onListening: async () => {
          const response = await globalThis.fetch(`http://127.0.0.1:${port}/auth/callback?${params.toString()}`)
          expect(response.status).toBe(400)
          await response.text()
        },
      }),
    ).rejects.toThrow('OAuth callback did not include an authorization code.')
  })

  test('waitForStoreAuthCode rejects when the port is already in use', async () => {
    const port = await getAvailablePort()
    const server = createServer()
    await new Promise<void>((resolve, reject) => {
      server.on('error', reject)
      server.listen(port, '127.0.0.1', () => resolve())
    })

    await expect(
      waitForStoreAuthCode({
        store: 'shop.myshopify.com',
        state: 'state-123',
        port,
        timeoutMs: 1000,
      }),
    ).rejects.toThrow(`Port ${port} is already in use.`)

    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  })

  test('waitForStoreAuthCode rejects on timeout', async () => {
    const port = await getAvailablePort()

    await expect(
      waitForStoreAuthCode({
        store: 'shop.myshopify.com',
        state: 'state-123',
        port,
        timeoutMs: 25,
      }),
    ).rejects.toThrow('Timed out waiting for OAuth callback.')
  })

  test('exchangeStoreAuthCodeForToken sends PKCE params and returns token response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(
        JSON.stringify({
          access_token: 'token',
          scope: 'read_products',
          expires_in: 86400,
          refresh_token: 'refresh-token',
          associated_user: {id: 42, email: 'test@example.com'},
        }),
      ),
    } as any)

    const response = await exchangeStoreAuthCodeForToken({
      store: 'shop.myshopify.com',
      code: 'abc123',
      codeVerifier: 'test-verifier',
      redirectUri: 'http://127.0.0.1:13387/auth/callback',
    })

    expect(response.access_token).toBe('token')
    expect(response.refresh_token).toBe('refresh-token')
    expect(response.expires_in).toBe(86400)

    expect(fetch).toHaveBeenCalledWith(
      'https://shop.myshopify.com/admin/oauth/access_token',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"code_verifier":"test-verifier"'),
      }),
    )

    const sentBody = JSON.parse((fetch as any).mock.calls[0][1].body)
    expect(sentBody.client_id).toBe(STORE_AUTH_APP_CLIENT_ID)
    expect(sentBody.code).toBe('abc123')
    expect(sentBody.code_verifier).toBe('test-verifier')
    expect(sentBody.redirect_uri).toBe('http://127.0.0.1:13387/auth/callback')
    expect(sentBody.client_secret).toBeUndefined()
  })

  test('authenticateStoreWithApp opens the browser and stores the session with refresh token', async () => {
    const openURL = vi.fn().mockResolvedValue(true)
    const renderSuccess = vi.fn()
    const waitForStoreAuthCodeMock = vi.fn().mockImplementation(async (options) => {
      await options.onListening?.()
      return 'abc123'
    })

    await authenticateStoreWithApp(
      {
        store: 'shop.myshopify.com',
        scopes: 'read_products',
      },
      {
        openURL,
        waitForStoreAuthCode: waitForStoreAuthCodeMock,
        exchangeStoreAuthCodeForToken: vi.fn().mockResolvedValue({
          access_token: 'token',
          scope: 'read_products',
          expires_in: 86400,
          refresh_token: 'refresh-token',
          associated_user: {id: 42, email: 'test@example.com'},
        }),
        renderInfo: vi.fn(),
        renderSuccess,
      },
    )

    expect(openURL).toHaveBeenCalledWith(expect.stringContaining('/admin/oauth/authorize?'))
    expect(renderSuccess).toHaveBeenCalledWith({
      headline: 'Store authentication succeeded.',
      body: 'Authenticated as test@example.com against shop.myshopify.com.',
    })

    const storedSession = vi.mocked(setStoredStoreAppSession).mock.calls[0]![0]
    expect(storedSession.store).toBe('shop.myshopify.com')
    expect(storedSession.clientId).toBe(STORE_AUTH_APP_CLIENT_ID)
    expect(storedSession.userId).toBe('42')
    expect(storedSession.accessToken).toBe('token')
    expect(storedSession.refreshToken).toBe('refresh-token')
    expect(storedSession.scopes).toEqual(['read_products'])
    expect(storedSession.expiresAt).toBeDefined()
    expect(storedSession.associatedUser).toEqual({
      id: 42,
      email: 'test@example.com',
      firstName: undefined,
      lastName: undefined,
      accountOwner: undefined,
    })
  })

  test('authenticateStoreWithApp rejects when Shopify grants fewer scopes than requested', async () => {
    const waitForStoreAuthCodeMock = vi.fn().mockImplementation(async (options) => {
      await options.onListening?.()
      return 'abc123'
    })

    await expect(
      authenticateStoreWithApp(
        {
          store: 'shop.myshopify.com',
          scopes: 'read_products,write_products',
        },
        {
          openURL: vi.fn().mockResolvedValue(true),
          waitForStoreAuthCode: waitForStoreAuthCodeMock,
          exchangeStoreAuthCodeForToken: vi.fn().mockResolvedValue({
            access_token: 'token',
            scope: 'read_products',
            expires_in: 86400,
            associated_user: {id: 42, email: 'test@example.com'},
          }),
          renderInfo: vi.fn(),
          renderSuccess: vi.fn(),
        },
      ),
    ).rejects.toThrow('Shopify granted fewer scopes than were requested.')

    expect(setStoredStoreAppSession).not.toHaveBeenCalled()
  })

  test('authenticateStoreWithApp accepts compressed write scopes that imply requested read scopes', async () => {
    const waitForStoreAuthCodeMock = vi.fn().mockImplementation(async (options) => {
      await options.onListening?.()
      return 'abc123'
    })

    await authenticateStoreWithApp(
      {
        store: 'shop.myshopify.com',
        scopes: 'read_products,write_products',
      },
      {
        openURL: vi.fn().mockResolvedValue(true),
        waitForStoreAuthCode: waitForStoreAuthCodeMock,
        exchangeStoreAuthCodeForToken: vi.fn().mockResolvedValue({
          access_token: 'token',
          scope: 'write_products',
          expires_in: 86400,
          associated_user: {id: 42, email: 'test@example.com'},
        }),
        renderInfo: vi.fn(),
        renderSuccess: vi.fn(),
      },
    )

    expect(setStoredStoreAppSession).toHaveBeenCalledWith(
      expect.objectContaining({
        store: 'shop.myshopify.com',
        scopes: ['write_products'],
      }),
    )
  })

  test('authenticateStoreWithApp still rejects when other requested scopes are missing', async () => {
    const waitForStoreAuthCodeMock = vi.fn().mockImplementation(async (options) => {
      await options.onListening?.()
      return 'abc123'
    })

    await expect(
      authenticateStoreWithApp(
        {
          store: 'shop.myshopify.com',
          scopes: 'read_products,write_products,read_orders',
        },
        {
          openURL: vi.fn().mockResolvedValue(true),
          waitForStoreAuthCode: waitForStoreAuthCodeMock,
          exchangeStoreAuthCodeForToken: vi.fn().mockResolvedValue({
            access_token: 'token',
            scope: 'write_products',
            expires_in: 86400,
            associated_user: {id: 42, email: 'test@example.com'},
          }),
          renderInfo: vi.fn(),
          renderSuccess: vi.fn(),
        },
      ),
    ).rejects.toThrow('Shopify granted fewer scopes than were requested.')

    expect(setStoredStoreAppSession).not.toHaveBeenCalled()
  })

  test('authenticateStoreWithApp falls back to requested scopes when Shopify omits granted scopes', async () => {
    const waitForStoreAuthCodeMock = vi.fn().mockImplementation(async (options) => {
      await options.onListening?.()
      return 'abc123'
    })

    await authenticateStoreWithApp(
      {
        store: 'shop.myshopify.com',
        scopes: 'read_products',
      },
      {
        openURL: vi.fn().mockResolvedValue(true),
        waitForStoreAuthCode: waitForStoreAuthCodeMock,
        exchangeStoreAuthCodeForToken: vi.fn().mockResolvedValue({
          access_token: 'token',
          expires_in: 86400,
          associated_user: {id: 42, email: 'test@example.com'},
        }),
        renderInfo: vi.fn(),
        renderSuccess: vi.fn(),
      },
    )

    expect(setStoredStoreAppSession).toHaveBeenCalledWith(
      expect.objectContaining({
        store: 'shop.myshopify.com',
        scopes: ['read_products'],
      }),
    )
  })

  test('authenticateStoreWithApp accepts compressed unauthenticated write scopes that imply requested unauthenticated read scopes', async () => {
    const waitForStoreAuthCodeMock = vi.fn().mockImplementation(async (options) => {
      await options.onListening?.()
      return 'abc123'
    })

    await authenticateStoreWithApp(
      {
        store: 'shop.myshopify.com',
        scopes: 'unauthenticated_read_product_listings,unauthenticated_write_product_listings',
      },
      {
        openURL: vi.fn().mockResolvedValue(true),
        waitForStoreAuthCode: waitForStoreAuthCodeMock,
        exchangeStoreAuthCodeForToken: vi.fn().mockResolvedValue({
          access_token: 'token',
          scope: 'unauthenticated_write_product_listings',
          expires_in: 86400,
          associated_user: {id: 42, email: 'test@example.com'},
        }),
        renderInfo: vi.fn(),
        renderSuccess: vi.fn(),
      },
    )

    expect(setStoredStoreAppSession).toHaveBeenCalledWith(
      expect.objectContaining({
        store: 'shop.myshopify.com',
        scopes: ['unauthenticated_write_product_listings'],
      }),
    )
  })
})
