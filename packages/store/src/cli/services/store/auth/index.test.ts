import {authenticateStoreWithApp} from './index.js'
import {setStoredStoreAppSession} from './session-store.js'
import {STORE_AUTH_APP_CLIENT_ID} from './config.js'
import {recordStoreCommandUserId} from '../metrics.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('./session-store.js')
vi.mock('../metrics.js')
vi.mock('@shopify/cli-kit/node/system', () => ({openURL: vi.fn().mockResolvedValue(true)}))
vi.mock('@shopify/cli-kit/node/crypto', () => ({randomUUID: vi.fn().mockReturnValue('state-123')}))

describe('store auth service', () => {
  test('authenticateStoreWithApp opens the browser, stores the session, and returns auth result', async () => {
    const openURL = vi.fn().mockResolvedValue(true)
    const presenter = {
      openingBrowser: vi.fn(),
      manualAuthUrl: vi.fn(),
      success: vi.fn(),
    }
    const waitForStoreAuthCodeMock = vi.fn().mockImplementation(async (options) => {
      await options.onListening?.()
      return 'abc123'
    })

    const result = await authenticateStoreWithApp(
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
        presenter,
      },
    )

    expect(presenter.openingBrowser).toHaveBeenCalledOnce()
    expect(openURL).toHaveBeenCalledWith(expect.stringContaining('/admin/oauth/authorize?'))
    expect(presenter.manualAuthUrl).not.toHaveBeenCalled()
    expect(result).toEqual(
      expect.objectContaining({
        store: 'shop.myshopify.com',
        userId: '42',
        scopes: ['read_products'],
        hasRefreshToken: true,
        associatedUser: expect.objectContaining({email: 'test@example.com'}),
      }),
    )
    expect(presenter.success).toHaveBeenCalledWith(result)
    expect(recordStoreCommandUserId).toHaveBeenCalledWith('42')

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

  test('authenticateStoreWithApp uses remote scopes by default when available', async () => {
    const openURL = vi.fn().mockResolvedValue(true)
    const presenter = {
      openingBrowser: vi.fn(),
      manualAuthUrl: vi.fn(),
      success: vi.fn(),
    }
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
          scope: 'read_customers,read_products',
          expires_in: 86400,
          associated_user: {id: 42, email: 'test@example.com'},
        }),
        resolveExistingScopes: vi.fn().mockResolvedValue({scopes: ['read_customers'], authoritative: true}),
        presenter,
      },
    )

    const authorizationUrl = new URL(openURL.mock.calls[0]![0])
    expect(authorizationUrl.searchParams.get('scope')).toBe('read_customers,read_products')
  })

  test('authenticateStoreWithApp reuses resolved existing scopes when requesting additional access', async () => {
    const openURL = vi.fn().mockResolvedValue(true)
    const presenter = {
      openingBrowser: vi.fn(),
      manualAuthUrl: vi.fn(),
      success: vi.fn(),
    }
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
          scope: 'read_orders,read_products',
          expires_in: 86400,
          associated_user: {id: 42, email: 'test@example.com'},
        }),
        resolveExistingScopes: vi.fn().mockResolvedValue({scopes: ['read_orders'], authoritative: true}),
        presenter,
      },
    )

    const authorizationUrl = new URL(openURL.mock.calls[0]![0])
    expect(authorizationUrl.searchParams.get('scope')).toBe('read_orders,read_products')
    expect(setStoredStoreAppSession).toHaveBeenCalledWith(
      expect.objectContaining({
        store: 'shop.myshopify.com',
        scopes: ['read_orders', 'read_products'],
      }),
    )
  })

  test('authenticateStoreWithApp does not require non-authoritative cached scopes to still be granted', async () => {
    const openURL = vi.fn().mockResolvedValue(true)
    const presenter = {
      openingBrowser: vi.fn(),
      manualAuthUrl: vi.fn(),
      success: vi.fn(),
    }
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
          associated_user: {id: 42, email: 'test@example.com'},
        }),
        resolveExistingScopes: vi.fn().mockResolvedValue({scopes: ['read_orders'], authoritative: false}),
        presenter,
      },
    )

    const authorizationUrl = new URL(openURL.mock.calls[0]![0])
    expect(authorizationUrl.searchParams.get('scope')).toBe('read_orders,read_products')
    expect(setStoredStoreAppSession).toHaveBeenCalledWith(
      expect.objectContaining({
        store: 'shop.myshopify.com',
        scopes: ['read_products'],
      }),
    )
  })

  test('authenticateStoreWithApp avoids requesting redundant read scopes already implied by existing write scopes', async () => {
    const openURL = vi.fn().mockResolvedValue(true)
    const presenter = {
      openingBrowser: vi.fn(),
      manualAuthUrl: vi.fn(),
      success: vi.fn(),
    }
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
          scope: 'write_products',
          expires_in: 86400,
          associated_user: {id: 42, email: 'test@example.com'},
        }),
        resolveExistingScopes: vi.fn().mockResolvedValue({scopes: ['write_products'], authoritative: true}),
        presenter,
      },
    )

    const authorizationUrl = new URL(openURL.mock.calls[0]![0])
    expect(authorizationUrl.searchParams.get('scope')).toBe('write_products')
    expect(setStoredStoreAppSession).toHaveBeenCalledWith(
      expect.objectContaining({
        store: 'shop.myshopify.com',
        scopes: ['write_products'],
      }),
    )
  })

  test('authenticateStoreWithApp shows a manual auth URL when the browser does not open automatically', async () => {
    const openURL = vi.fn().mockResolvedValue(false)
    const presenter = {
      openingBrowser: vi.fn(),
      manualAuthUrl: vi.fn(),
      success: vi.fn(),
    }
    const waitForStoreAuthCodeMock = vi.fn().mockImplementation(async (options) => {
      await options.onListening?.()
      return 'abc123'
    })

    const result = await authenticateStoreWithApp(
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
          associated_user: {id: 42, email: 'test@example.com'},
        }),
        presenter,
      },
    )

    expect(presenter.openingBrowser).toHaveBeenCalledOnce()
    expect(presenter.manualAuthUrl).toHaveBeenCalledWith(
      expect.stringContaining('https://shop.myshopify.com/admin/oauth/authorize?'),
    )
    expect(presenter.success).toHaveBeenCalledWith(result)
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
          presenter: {
            openingBrowser: vi.fn(),
            manualAuthUrl: vi.fn(),
            success: vi.fn(),
          },
        },
      ),
    ).rejects.toMatchObject({
      message: 'Shopify granted fewer scopes than were requested.',
      tryMessage: 'Missing scopes: write_products.',
      nextSteps: [
        'Update the app or store installation scopes.',
        'See https://shopify.dev/app/scopes',
        'Re-run shopify store auth.',
      ],
    })

    expect(setStoredStoreAppSession).not.toHaveBeenCalled()
  })

  test('authenticateStoreWithApp succeeds when scopes input is space-separated', async () => {
    const waitForStoreAuthCodeMock = vi.fn().mockImplementation(async (options) => {
      await options.onListening?.()
      return 'abc123'
    })

    const result = await authenticateStoreWithApp(
      {
        store: 'shop.myshopify.com',
        scopes: 'read_products read_inventory',
      },
      {
        openURL: vi.fn().mockResolvedValue(true),
        waitForStoreAuthCode: waitForStoreAuthCodeMock,
        exchangeStoreAuthCodeForToken: vi.fn().mockResolvedValue({
          access_token: 'token',
          scope: 'read_products,read_inventory',
          expires_in: 86400,
          associated_user: {id: 42, email: 'test@example.com'},
        }),
        presenter: {
          openingBrowser: vi.fn(),
          manualAuthUrl: vi.fn(),
          success: vi.fn(),
        },
      },
    )

    expect(result.scopes).toEqual(['read_products', 'read_inventory'])
    expect(setStoredStoreAppSession).toHaveBeenCalledWith(
      expect.objectContaining({
        scopes: ['read_products', 'read_inventory'],
      }),
    )
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
        presenter: {
          openingBrowser: vi.fn(),
          manualAuthUrl: vi.fn(),
          success: vi.fn(),
        },
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
          presenter: {
            openingBrowser: vi.fn(),
            manualAuthUrl: vi.fn(),
            success: vi.fn(),
          },
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
        presenter: {
          openingBrowser: vi.fn(),
          manualAuthUrl: vi.fn(),
          success: vi.fn(),
        },
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
        presenter: {
          openingBrowser: vi.fn(),
          manualAuthUrl: vi.fn(),
          success: vi.fn(),
        },
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
