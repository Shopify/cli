import {createServer} from 'http'
import {createHmac} from 'crypto'
import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest'
import {
  authenticateStoreWithApp,
  buildStoreAuthUrl,
  parseStoreAuthScopes,
  verifyStoreAuthHmac,
  exchangeStoreAuthCodeForToken,
  waitForStoreAuthCode,
} from './auth.js'
import {setStoredStoreAppSession} from './session.js'
import {fileExists, readFile} from '@shopify/cli-kit/node/fs'
import {fetch} from '@shopify/cli-kit/node/http'

vi.mock('./session.js')
vi.mock('@shopify/cli-kit/node/fs')
vi.mock('@shopify/cli-kit/node/http')
vi.mock('@shopify/cli-kit/node/system', () => ({openURL: vi.fn().mockResolvedValue(true)}))
vi.mock('@shopify/cli-kit/node/crypto', () => ({randomUUID: vi.fn().mockReturnValue('state-123')}))

async function getAvailablePort(): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const server = createServer()

    server.on('error', reject)
    server.listen(0, 'localhost', () => {
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

function signedCallbackParams(options?: {
  code?: string
  shop?: string
  state?: string
  timestamp?: string
  error?: string
  clientSecret?: string
}): URLSearchParams {
  const params = new URLSearchParams()
  params.set('shop', options?.shop ?? 'shop.myshopify.com')
  params.set('state', options?.state ?? 'state-123')
  params.set('timestamp', options?.timestamp ?? '1711550000')

  if (options?.code) params.set('code', options.code)
  if (options?.error) params.set('error', options.error)
  if (!options?.code && !options?.error) params.set('code', 'abc123')

  const message = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')

  const hmac = createHmac('sha256', options?.clientSecret ?? 'secret-value').update(message).digest('hex')
  params.set('hmac', hmac)

  return params
}

describe('store auth service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fileExists).mockResolvedValue(true)
    vi.mocked(readFile).mockResolvedValue('secret-value' as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('parseStoreAuthScopes splits and deduplicates scopes', () => {
    expect(parseStoreAuthScopes('read_products, write_products,read_products')).toEqual([
      'read_products',
      'write_products',
    ])
  })

  test('buildStoreAuthUrl includes per-user grant options', () => {
    const url = new URL(
      buildStoreAuthUrl({
        store: 'shop.myshopify.com',
        scopes: ['read_products', 'write_products'],
        state: 'state-123',
        redirectUri: 'http://localhost:3458/auth/callback',
      }),
    )

    expect(url.hostname).toBe('shop.myshopify.com')
    expect(url.pathname).toBe('/admin/oauth/authorize')
    expect(url.searchParams.get('client_id')).toBe('4c6af92692662b9c95c8a47b1520aced')
    expect(url.searchParams.get('scope')).toBe('read_products,write_products')
    expect(url.searchParams.get('state')).toBe('state-123')
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3458/auth/callback')
    expect(url.searchParams.getAll('grant_options[]')).toEqual(['per-user'])
  })

  test('verifyStoreAuthHmac validates Shopify callback signatures', () => {
    const params = signedCallbackParams()

    expect(verifyStoreAuthHmac(params, 'secret-value')).toBe(true)
    expect(verifyStoreAuthHmac(params, 'wrong-secret')).toBe(false)
  })

  test('waitForStoreAuthCode resolves after a valid callback', async () => {
    const port = await getAvailablePort()
    const callbackParams = signedCallbackParams()
    const onListening = vi.fn(async () => {
      const response = await globalThis.fetch(
        `http://localhost:${port}/auth/callback?${callbackParams.toString()}`,
      )
      expect(response.status).toBe(200)
      await response.text()
    })

    await expect(
      waitForStoreAuthCode({
        store: 'shop.myshopify.com',
        state: 'state-123',
        clientSecret: 'secret-value',
        port,
        timeoutMs: 1000,
        onListening,
      }),
    ).resolves.toBe('abc123')

    expect(onListening).toHaveBeenCalledOnce()
  })

  test('waitForStoreAuthCode rejects when callback state does not match', async () => {
    const port = await getAvailablePort()
    const callbackParams = signedCallbackParams({state: 'wrong-state'})

    await expect(
      waitForStoreAuthCode({
        store: 'shop.myshopify.com',
        state: 'state-123',
        clientSecret: 'secret-value',
        port,
        timeoutMs: 1000,
        onListening: async () => {
          const response = await globalThis.fetch(
            `http://localhost:${port}/auth/callback?${callbackParams.toString()}`,
          )
          expect(response.status).toBe(400)
          await response.text()
        },
      }),
    ).rejects.toThrow('OAuth callback state does not match the original request.')
  })

  test('waitForStoreAuthCode rejects when the port is already in use', async () => {
    const port = await getAvailablePort()
    const server = createServer()
    await new Promise<void>((resolve, reject) => {
      server.on('error', reject)
      server.listen(port, 'localhost', () => resolve())
    })

    await expect(
      waitForStoreAuthCode({
        store: 'shop.myshopify.com',
        state: 'state-123',
        clientSecret: 'secret-value',
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
        clientSecret: 'secret-value',
        port,
        timeoutMs: 25,
      }),
    ).rejects.toThrow('Timed out waiting for OAuth callback.')
  })

  test('exchangeStoreAuthCodeForToken returns token response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('{"access_token":"token","scope":"read_products","associated_user":{"id":42}}'),
    } as any)

    const response = await exchangeStoreAuthCodeForToken({
      store: 'shop.myshopify.com',
      code: 'abc123',
      clientSecret: 'secret-value',
    })

    expect(response).toEqual({
      access_token: 'token',
      scope: 'read_products',
      associated_user: {id: 42},
    })
  })

  test('authenticateStoreWithApp opens the browser after the listener is ready and stores the app session', async () => {
    const openURL = vi.fn().mockResolvedValue(true)
    const waitForStoreAuthCodeMock = vi.fn().mockImplementation(async (options) => {
      await options.onListening?.()
      return 'abc123'
    })

    await authenticateStoreWithApp(
      {
        store: 'shop.myshopify.com',
        scopes: 'read_products',
        clientSecretFile: '/tmp/client-secret.txt',
        port: 3458,
      },
      {
        openURL,
        waitForStoreAuthCode: waitForStoreAuthCodeMock,
        exchangeStoreAuthCodeForToken: vi.fn().mockResolvedValue({
          access_token: 'token',
          scope: 'read_products',
          associated_user: {id: 42},
        }),
        renderInfo: vi.fn(),
        renderSuccess: vi.fn(),
      },
    )

    expect(openURL).toHaveBeenCalledWith(
      expect.stringContaining('/admin/oauth/authorize?'),
    )
    expect(setStoredStoreAppSession).toHaveBeenCalledWith({
      store: 'shop.myshopify.com',
      clientId: '4c6af92692662b9c95c8a47b1520aced',
      userId: '42',
      accessToken: 'token',
      scopes: ['read_products'],
      acquiredAt: expect.any(String),
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
          clientSecretFile: '/tmp/client-secret.txt',
          port: 3458,
        },
        {
          openURL: vi.fn().mockResolvedValue(true),
          waitForStoreAuthCode: waitForStoreAuthCodeMock,
          exchangeStoreAuthCodeForToken: vi.fn().mockResolvedValue({
            access_token: 'token',
            scope: 'read_products',
            associated_user: {id: 42},
          }),
          renderInfo: vi.fn(),
          renderSuccess: vi.fn(),
        },
      ),
    ).rejects.toThrow('Shopify granted fewer scopes than were requested.')

    expect(setStoredStoreAppSession).not.toHaveBeenCalled()
  })

  test('authenticateStoreWithApp rejects when Shopify omits granted scopes', async () => {
    const waitForStoreAuthCodeMock = vi.fn().mockImplementation(async (options) => {
      await options.onListening?.()
      return 'abc123'
    })

    await expect(
      authenticateStoreWithApp(
        {
          store: 'shop.myshopify.com',
          scopes: 'read_products',
          clientSecretFile: '/tmp/client-secret.txt',
          port: 3458,
        },
        {
          openURL: vi.fn().mockResolvedValue(true),
          waitForStoreAuthCode: waitForStoreAuthCodeMock,
          exchangeStoreAuthCodeForToken: vi.fn().mockResolvedValue({
            access_token: 'token',
            associated_user: {id: 42},
          }),
          renderInfo: vi.fn(),
          renderSuccess: vi.fn(),
        },
      ),
    ).rejects.toThrow('Shopify did not return granted scopes for the online access token.')

    expect(setStoredStoreAppSession).not.toHaveBeenCalled()
  })
})
