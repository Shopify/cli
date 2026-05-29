import {createPreviewStore} from './client.js'
import {createPreviewStoreCommand, placeholderUserId, PLACEHOLDER_USER_ID_PREFIX} from './index.js'
import {setStoredStoreAppSession} from '../../auth/session-store.js'
import {recordStoreFqdnMetadata} from '../../attribution.js'
import {setLastSeenUserId} from '@shopify/cli-kit/node/session'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('./client.js', async () => {
  // `defaultPreviewStoreClientOptions` is a pure factory the orchestrator calls before
  // delegating to the network helper. Keep it real so the persisted session reflects
  // the resolved options; only stub `createPreviewStore` itself.
  const actual = await vi.importActual<typeof import('./client.js')>('./client.js')
  return {
    ...actual,
    createPreviewStore: vi.fn(),
  }
})
vi.mock('../../auth/session-store.js')
vi.mock('../../attribution.js')
vi.mock('@shopify/cli-kit/node/session')

const fakeResponse = {
  shopId: 21,
  shopPermanentDomain: 'preview-1.my.shop.dev',
  placeholderAccountUuid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  adminApiToken: 'legacy_admin_api_token',
  magicLinkUrl: 'https://app.shop.dev/auth/preview-store?token=abc',
  storeAuthBootstrap: {
    accessToken: 'shpat_preview_token',
    scopes: ['read_themes', 'write_themes'],
    apiKey: 'development-shop-merchant-key',
    shopDomain: 'preview-1.dev-api.shop.dev',
  },
}

const fixedNow = new Date('2026-03-27T00:00:00.000Z')

describe('placeholderUserId', () => {
  test('namespaces the placeholder UUID with a stable, non-numeric prefix', () => {
    expect(placeholderUserId('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')).toBe(
      `${PLACEHOLDER_USER_ID_PREFIX}aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`,
    )
  })
})

describe('createPreviewStoreCommand', () => {
  beforeEach(() => {
    vi.mocked(createPreviewStore).mockReset()
    vi.mocked(setStoredStoreAppSession).mockReset()
    vi.mocked(recordStoreFqdnMetadata).mockReset()
    vi.mocked(setLastSeenUserId).mockReset()
    vi.mocked(recordStoreFqdnMetadata).mockResolvedValue(undefined)
  })

  test('forwards the request to the client, including override client options', async () => {
    vi.mocked(createPreviewStore).mockResolvedValue(fakeResponse)

    await createPreviewStoreCommand(
      {shopName: 'preview-demo', email: 'demo@previewstore.invalid', country: 'CA', client: {coreUrl: 'https://core.example'}},
      () => fixedNow,
    )

    expect(createPreviewStore).toHaveBeenCalledWith(
      {shopName: 'preview-demo', email: 'demo@previewstore.invalid', country: 'CA'},
      expect.objectContaining({coreUrl: 'https://core.example'}),
    )
  })

  test('persists the response as a kind=preview stored session under a placeholder userId', async () => {
    vi.mocked(createPreviewStore).mockResolvedValue(fakeResponse)

    await createPreviewStoreCommand({shopName: 'preview-demo'}, () => fixedNow)

    expect(setStoredStoreAppSession).toHaveBeenCalledTimes(1)
    expect(setStoredStoreAppSession).toHaveBeenCalledWith({
      store: fakeResponse.storeAuthBootstrap.shopDomain,
      clientId: fakeResponse.storeAuthBootstrap.apiKey,
      userId: `${PLACEHOLDER_USER_ID_PREFIX}${fakeResponse.placeholderAccountUuid}`,
      accessToken: fakeResponse.storeAuthBootstrap.accessToken,
      scopes: fakeResponse.storeAuthBootstrap.scopes,
      acquiredAt: fixedNow.toISOString(),
      kind: 'preview',
      preview: {
        placeholderAccountUuid: fakeResponse.placeholderAccountUuid,
        coreUrl: 'https://app.shop.dev',
        storefrontDomain: fakeResponse.shopPermanentDomain,
        magicLinkUrl: fakeResponse.magicLinkUrl,
        magicLinkExpiresAt: '2026-03-27T00:30:00.000Z',
      },
    })
  })

  test('records fqdn metadata twice (unvalidated then validated) so analytics see the same shape as PKCE auth', async () => {
    vi.mocked(createPreviewStore).mockResolvedValue(fakeResponse)

    await createPreviewStoreCommand({shopName: 'preview-demo'}, () => fixedNow)

    expect(recordStoreFqdnMetadata).toHaveBeenCalledWith(fakeResponse.storeAuthBootstrap.shopDomain, false)
    expect(recordStoreFqdnMetadata).toHaveBeenCalledWith(fakeResponse.storeAuthBootstrap.shopDomain, true)
  })

  test('updates the last-seen user id so the session lookup later picks up the new identity', async () => {
    vi.mocked(createPreviewStore).mockResolvedValue(fakeResponse)

    await createPreviewStoreCommand({shopName: 'preview-demo'}, () => fixedNow)

    expect(setLastSeenUserId).toHaveBeenCalledWith(`${PLACEHOLDER_USER_ID_PREFIX}${fakeResponse.placeholderAccountUuid}`)
  })

  test('returns a result struct that surfaces the persisted user id and the magic-link expiry derived locally', async () => {
    vi.mocked(createPreviewStore).mockResolvedValue(fakeResponse)

    const result = await createPreviewStoreCommand({shopName: 'preview-demo'}, () => fixedNow)

    expect(result).toEqual({
      shopId: fakeResponse.shopId,
      shopPermanentDomain: fakeResponse.shopPermanentDomain,
      placeholderAccountUuid: fakeResponse.placeholderAccountUuid,
      adminApiToken: fakeResponse.storeAuthBootstrap.accessToken,
      adminDomain: fakeResponse.storeAuthBootstrap.shopDomain,
      storefrontDomain: fakeResponse.shopPermanentDomain,
      magicLinkUrl: fakeResponse.magicLinkUrl,
      magicLinkExpiresAt: '2026-03-27T00:30:00.000Z',
      userId: `${PLACEHOLDER_USER_ID_PREFIX}${fakeResponse.placeholderAccountUuid}`,
    })
  })

  test('does not invoke setStoredStoreAppSession if the underlying client call rejects', async () => {
    vi.mocked(createPreviewStore).mockRejectedValue(new Error('boom'))

    await expect(createPreviewStoreCommand({shopName: 'preview-demo'}, () => fixedNow)).rejects.toThrow('boom')
    expect(setStoredStoreAppSession).not.toHaveBeenCalled()
    expect(setLastSeenUserId).not.toHaveBeenCalled()
  })
})
