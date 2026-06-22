import {PREVIEW_USER_ID_PREFIX, createPreviewStoreCommand} from './index.js'
import {STORE_AUTH_APP_CLIENT_ID} from '../../auth/config.js'
import {describe, expect, test, vi} from 'vitest'

describe('preview store create service', () => {
  test('persists the created preview store in the store-auth cache', async () => {
    const setStoredStoreAppSession = vi.fn()
    const recordStoreFqdnMetadata = vi.fn()
    const setLastSeenUserId = vi.fn()

    const result = await createPreviewStoreCommand(
      {name: 'Lavender Candles', country: 'US'},
      {
        createPreviewStore: vi.fn(async () => ({
          shop: {id: '123', name: 'Lavender Candles', domain: 'x12y45z.myshopify.com'},
          placeholderAccountUuid: 'placeholder-uuid',
          adminApiToken: 'shpat_token',
          accessUrl: 'https://app.shopify.com/auth/preview-store?token=access-token',
        })),
        setStoredStoreAppSession,
        recordStoreFqdnMetadata,
        setLastSeenUserId,
        now: () => new Date('2026-06-08T12:00:00.000Z'),
      },
    )

    expect(setStoredStoreAppSession).toHaveBeenCalledWith({
      store: 'x12y45z.myshopify.com',
      clientId: STORE_AUTH_APP_CLIENT_ID,
      userId: `${PREVIEW_USER_ID_PREFIX}placeholder-uuid`,
      accessToken: 'shpat_token',
      scopes: [],
      acquiredAt: '2026-06-08T12:00:00.000Z',
      kind: 'preview',
      preview: {
        shopId: '123',
        name: 'Lavender Candles',
        placeholderAccountUuid: 'placeholder-uuid',
        country: 'US',
        createdAt: '2026-06-08T12:00:00.000Z',
        accessUrl: 'https://app.shopify.com/auth/preview-store?token=access-token',
      },
    })
    expect(recordStoreFqdnMetadata).toHaveBeenCalledOnce()
    expect(recordStoreFqdnMetadata).toHaveBeenCalledWith('x12y45z.myshopify.com', true, '123')
    expect(setLastSeenUserId).toHaveBeenCalledWith(`${PREVIEW_USER_ID_PREFIX}placeholder-uuid`)
    expect(result).toEqual({
      status: 'success',
      message:
        'Your Shopify store is ready. This store is temporary. Create a free Shopify account to save it and start selling.',
      store: {
        id: '123',
        name: 'Lavender Candles',
        subdomain: 'x12y45z.myshopify.com',
        country: 'US',
        storefrontUrl: 'https://app.shopify.com/auth/preview-store?token=access-token',
      },
    })
  })

  test('uses the shop id as the preview user id when no placeholder account uuid is returned', async () => {
    const setStoredStoreAppSession = vi.fn()
    const setLastSeenUserId = vi.fn()

    await createPreviewStoreCommand(
      {name: 'Lavender Candles'},
      {
        createPreviewStore: vi.fn(async () => ({
          shop: {id: '123', name: 'Lavender Candles', domain: 'x12y45z.myshopify.com'},
          adminApiToken: 'shpat_token',
          accessUrl: 'https://app.shopify.com/auth/preview-store?token=access-token',
        })),
        setStoredStoreAppSession,
        recordStoreFqdnMetadata: vi.fn(),
        setLastSeenUserId,
        now: () => new Date('2026-06-08T12:00:00.000Z'),
      },
    )

    expect(setStoredStoreAppSession).toHaveBeenCalledWith(
      expect.objectContaining({userId: `${PREVIEW_USER_ID_PREFIX}123`}),
    )
    expect(setLastSeenUserId).toHaveBeenCalledWith(`${PREVIEW_USER_ID_PREFIX}123`)
  })

  test('passes client options to the create request', async () => {
    const client = {} as any
    const createPreviewStore = vi.fn(async () => ({
      shop: {id: '123', name: 'Lavender Candles', domain: 'x12y45z.myshopify.com'},
      adminApiToken: 'shpat_token',
      accessUrl: 'https://app.shopify.com/auth/preview-store?token=access-token',
    }))

    await createPreviewStoreCommand(
      {client},
      {
        createPreviewStore,
        setStoredStoreAppSession: vi.fn(),
        recordStoreFqdnMetadata: vi.fn(),
        setLastSeenUserId: vi.fn(),
        now: () => new Date('2026-06-08T12:00:00.000Z'),
      },
    )

    expect(createPreviewStore).toHaveBeenCalledWith({name: undefined, country: undefined}, client)
  })

  test('persists a store session and returns success when recording store metadata fails', async () => {
    const setStoredStoreAppSession = vi.fn()
    const recordStoreFqdnMetadata = vi.fn(async () => {
      throw new Error('Metadata failed.')
    })
    const setLastSeenUserId = vi.fn()

    const result = await createPreviewStoreCommand(
      {name: 'Lavender Candles'},
      {
        createPreviewStore: vi.fn(async () => ({
          shop: {id: '123', name: 'Lavender Candles', domain: 'x12y45z.myshopify.com'},
          adminApiToken: 'shpat_token',
          accessUrl: 'https://app.shopify.com/auth/preview-store?token=access-token',
        })),
        setStoredStoreAppSession,
        recordStoreFqdnMetadata,
        setLastSeenUserId,
        now: () => new Date('2026-06-08T12:00:00.000Z'),
      },
    )

    expect(setStoredStoreAppSession).toHaveBeenCalledOnce()
    expect(setLastSeenUserId).toHaveBeenCalledWith(`${PREVIEW_USER_ID_PREFIX}123`)
    expect(recordStoreFqdnMetadata).toHaveBeenCalledOnce()
    expect(recordStoreFqdnMetadata).toHaveBeenCalledWith('x12y45z.myshopify.com', true, '123')
    expect(result.status).toBe('success')
  })

  test('does not persist a store session when preview store creation fails', async () => {
    const setStoredStoreAppSession = vi.fn()
    const recordStoreFqdnMetadata = vi.fn()
    const setLastSeenUserId = vi.fn()

    await expect(
      createPreviewStoreCommand(
        {name: 'Lavender Candles'},
        {
          createPreviewStore: vi.fn(async () => {
            throw new Error('Preview store creation failed.')
          }),
          setStoredStoreAppSession,
          recordStoreFqdnMetadata,
          setLastSeenUserId,
          now: () => new Date('2026-06-08T12:00:00.000Z'),
        },
      ),
    ).rejects.toThrow('Preview store creation failed.')

    expect(setStoredStoreAppSession).not.toHaveBeenCalled()
    expect(recordStoreFqdnMetadata).not.toHaveBeenCalled()
    expect(setLastSeenUserId).not.toHaveBeenCalled()
  })
})
