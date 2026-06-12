import {PREVIEW_USER_ID_PREFIX, createPreviewStoreCommand} from './index.js'
import {STORE_AUTH_APP_CLIENT_ID} from '../../auth/config.js'
import {describe, expect, test, vi} from 'vitest'

describe('preview store create service', () => {
  test('persists the created preview store in the store-auth cache', async () => {
    const setStoredStoreAppSession = vi.fn()
    const recordStoreFqdnMetadata = vi.fn()
    const setLastSeenUserId = vi.fn()
    const claimPreviewStore = vi.fn(async () => ({
      claimUrl: 'https://admin.shopify.com/store-transfer/accept/claim-token',
    }))

    const result = await createPreviewStoreCommand(
      {name: 'Lavender Candles', country: 'US'},
      {
        createPreviewStore: vi.fn(async () => ({
          shop: {id: '123', name: 'Lavender Candles', domain: 'x12y45z.myshopify.com'},
          placeholderAccountUuid: 'placeholder-uuid',
          adminApiToken: 'shpat_token',
          accessUrl: 'https://app.shopify.com/auth/preview-store?token=access-token',
        })),
        claimPreviewStore,
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
    expect(recordStoreFqdnMetadata).toHaveBeenCalledWith('x12y45z.myshopify.com', true)
    expect(setLastSeenUserId).toHaveBeenCalledWith(`${PREVIEW_USER_ID_PREFIX}placeholder-uuid`)
    expect(result).toEqual({
      status: 'success',
      message:
        'Your preview store is ready. This preview store is temporary. Create a free Shopify account to save it and start selling.',
      store: {
        id: '123',
        name: 'Lavender Candles',
        subdomain: 'x12y45z.myshopify.com',
        accessUrl: 'https://app.shopify.com/auth/preview-store?token=access-token',
        claimUrl: 'https://admin.shopify.com/store-transfer/accept/claim-token',
        requestedCountry: 'US',
      },
      nextSteps: [
        'Open https://app.shopify.com/auth/preview-store?token=access-token to view and access your preview store.',
        'Claim https://admin.shopify.com/store-transfer/accept/claim-token to save your preview store and continue editing later.',
        'Use shopify store execute --store x12y45z.myshopify.com to add products, collections, pages, and more.',
        'Use shopify theme pull and shopify theme push to edit your store design.',
      ],
    })
    expect(claimPreviewStore).toHaveBeenCalledWith({shopId: '123', adminApiToken: 'shpat_token'}, undefined)
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
        claimPreviewStore: vi.fn(async () => ({
          claimUrl: 'https://admin.shopify.com/store-transfer/accept/claim-token',
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

  test('passes client options to both create and claim requests', async () => {
    const client = {} as any
    const createPreviewStore = vi.fn(async () => ({
      shop: {id: '123', name: 'Lavender Candles', domain: 'x12y45z.myshopify.com'},
      adminApiToken: 'shpat_token',
      accessUrl: 'https://app.shopify.com/auth/preview-store?token=access-token',
    }))
    const claimPreviewStore = vi.fn(async () => ({
      claimUrl: 'https://admin.shopify.com/store-transfer/accept/claim-token',
    }))

    await createPreviewStoreCommand(
      {client},
      {
        createPreviewStore,
        claimPreviewStore,
        setStoredStoreAppSession: vi.fn(),
        recordStoreFqdnMetadata: vi.fn(),
        setLastSeenUserId: vi.fn(),
        now: () => new Date('2026-06-08T12:00:00.000Z'),
      },
    )

    expect(createPreviewStore).toHaveBeenCalledWith({name: undefined, country: undefined}, client)
    expect(claimPreviewStore).toHaveBeenCalledWith({shopId: '123', adminApiToken: 'shpat_token'}, client)
  })

  test('persists a store session before recording store metadata', async () => {
    const setStoredStoreAppSession = vi.fn()
    const recordStoreFqdnMetadata = vi.fn(async () => {
      throw new Error('Metadata failed.')
    })
    const setLastSeenUserId = vi.fn()

    await expect(
      createPreviewStoreCommand(
        {name: 'Lavender Candles'},
        {
          createPreviewStore: vi.fn(async () => ({
            shop: {id: '123', name: 'Lavender Candles', domain: 'x12y45z.myshopify.com'},
            adminApiToken: 'shpat_token',
            accessUrl: 'https://app.shopify.com/auth/preview-store?token=access-token',
          })),
          claimPreviewStore: vi.fn(async () => ({
            claimUrl: 'https://admin.shopify.com/store-transfer/accept/claim-token',
          })),
          setStoredStoreAppSession,
          recordStoreFqdnMetadata,
          setLastSeenUserId,
          now: () => new Date('2026-06-08T12:00:00.000Z'),
        },
      ),
    ).rejects.toThrow('Metadata failed.')

    expect(setStoredStoreAppSession).toHaveBeenCalledOnce()
    expect(setLastSeenUserId).toHaveBeenCalledWith(`${PREVIEW_USER_ID_PREFIX}123`)
    expect(recordStoreFqdnMetadata).toHaveBeenCalledOnce()
    expect(recordStoreFqdnMetadata).toHaveBeenCalledWith('x12y45z.myshopify.com', true)
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
          claimPreviewStore: vi.fn(async () => ({
            claimUrl: 'https://admin.shopify.com/store-transfer/accept/claim-token',
          })),
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
