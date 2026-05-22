import {createPreviewStore} from './client.js'
import {createPreviewStoreCommand, placeholderUserId, PLACEHOLDER_USER_ID_PREFIX} from './index.js'
import {STORE_AUTH_APP_CLIENT_ID} from '../../auth/config.js'
import {setStoredStoreAppSession} from '../../auth/session-store.js'
import {recordStoreFqdnMetadata} from '../../attribution.js'
import {importIdentitySession, setLastSeenUserId} from '@shopify/cli-kit/node/session'
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
  shopPermanentDomain: 'preview-1.myshopify.io',
  placeholderAccountUuid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  adminApiToken: 'shpat_preview_token',
  magicLinkUrl: 'https://app.shop.dev/auth/preview-store?token=abc',
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
    vi.mocked(importIdentitySession).mockReset()
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
      store: fakeResponse.shopPermanentDomain,
      clientId: STORE_AUTH_APP_CLIENT_ID,
      userId: `${PLACEHOLDER_USER_ID_PREFIX}${fakeResponse.placeholderAccountUuid}`,
      accessToken: fakeResponse.adminApiToken,
      // The granted scope set is not surfaced by Core; we record an empty array as a sentinel.
      scopes: [],
      acquiredAt: fixedNow.toISOString(),
      kind: 'preview',
      preview: {
        placeholderAccountUuid: fakeResponse.placeholderAccountUuid,
        coreUrl: 'https://app.shop.dev',
        magicLinkUrl: fakeResponse.magicLinkUrl,
        magicLinkExpiresAt: '2026-03-27T00:30:00.000Z',
      },
    })
  })

  test('records fqdn metadata twice (unvalidated then validated) so analytics see the same shape as PKCE auth', async () => {
    vi.mocked(createPreviewStore).mockResolvedValue(fakeResponse)

    await createPreviewStoreCommand({shopName: 'preview-demo'}, () => fixedNow)

    expect(recordStoreFqdnMetadata).toHaveBeenCalledWith(fakeResponse.shopPermanentDomain, false)
    expect(recordStoreFqdnMetadata).toHaveBeenCalledWith(fakeResponse.shopPermanentDomain, true)
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
      adminApiToken: fakeResponse.adminApiToken,
      magicLinkUrl: fakeResponse.magicLinkUrl,
      magicLinkExpiresAt: '2026-03-27T00:30:00.000Z',
      userId: `${PLACEHOLDER_USER_ID_PREFIX}${fakeResponse.placeholderAccountUuid}`,
      identityImported: false,
    })
  })

  test('does not invoke setStoredStoreAppSession if the underlying client call rejects', async () => {
    vi.mocked(createPreviewStore).mockRejectedValue(new Error('boom'))

    await expect(createPreviewStoreCommand({shopName: 'preview-demo'}, () => fixedNow)).rejects.toThrow('boom')
    expect(setStoredStoreAppSession).not.toHaveBeenCalled()
    expect(setLastSeenUserId).not.toHaveBeenCalled()
    expect(importIdentitySession).not.toHaveBeenCalled()
  })

  describe('when the orchestrator returns a cli_identity_bootstrap', () => {
    const bootstrapResponse = {
      ...fakeResponse,
      cliIdentityBootstrap: {
        accessToken: 'identity_access_token',
        refreshToken: 'identity_refresh_token',
        expiresIn: 3600,
        userId: fakeResponse.placeholderAccountUuid,
      },
    }

    test('persists the store-auth bucket under the synthetic id and additively imports the Identity session', async () => {
      vi.mocked(createPreviewStore).mockResolvedValue(bootstrapResponse)
      vi.mocked(importIdentitySession).mockResolvedValue({userId: fakeResponse.placeholderAccountUuid})

      const result = await createPreviewStoreCommand({shopName: 'preview-demo'}, () => fixedNow)

      // The store-auth bucket is always keyed under the synthetic placeholder id
      // so a failed Identity import can't orphan the shop on the CLI side.
      expect(setStoredStoreAppSession).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: `${PLACEHOLDER_USER_ID_PREFIX}${fakeResponse.placeholderAccountUuid}`,
          kind: 'preview',
        }),
      )
      // The Identity import is additive, keyed under the Identity-resolved UUID.
      // We also pass the result's `shopPermanentDomain` (the routable shop FQDN)
      // mapped to the Admin shop-app token (`shpat_*`) so `importIdentitySession`
      // seeds the store-prefixed Admin entry with a token the Admin API actually
      // accepts. The Identity OAuth token (`bootstrap.accessToken`) is rejected
      // by Admin with `[API] Service is not valid for authentication`; only the
      // shop-app token works there.
      expect(importIdentitySession).toHaveBeenCalledTimes(1)
      expect(importIdentitySession).toHaveBeenCalledWith({
        accessToken: 'identity_access_token',
        refreshToken: 'identity_refresh_token',
        expiresAt: expect.any(Date),
        userId: fakeResponse.placeholderAccountUuid,
        adminStoreTokens: {[fakeResponse.shopPermanentDomain]: fakeResponse.adminApiToken},
      })
      expect(setLastSeenUserId).toHaveBeenCalledWith(`${PLACEHOLDER_USER_ID_PREFIX}${fakeResponse.placeholderAccountUuid}`)
      expect(result.userId).toBe(`${PLACEHOLDER_USER_ID_PREFIX}${fakeResponse.placeholderAccountUuid}`)
      expect(result.identityImported).toBe(true)
      expect(result.identityUserId).toBe(fakeResponse.placeholderAccountUuid)
    })

    test('continues to persist the store-auth bucket when the Identity import throws', async () => {
      vi.mocked(createPreviewStore).mockResolvedValue(bootstrapResponse)
      vi.mocked(importIdentitySession).mockRejectedValue(new Error('Identity unreachable'))

      const result = await createPreviewStoreCommand({shopName: 'preview-demo'}, () => fixedNow)

      expect(setStoredStoreAppSession).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: `${PLACEHOLDER_USER_ID_PREFIX}${fakeResponse.placeholderAccountUuid}`,
          kind: 'preview',
        }),
      )
      expect(result.identityImported).toBe(false)
      expect(result.identityUserId).toBeUndefined()
    })

    test('falls back to the placeholder UUID when the bootstrap omits an explicit user id', async () => {
      const {userId: _omitted, ...bootstrapWithoutUserId} = bootstrapResponse.cliIdentityBootstrap
      vi.mocked(createPreviewStore).mockResolvedValue({
        ...bootstrapResponse,
        cliIdentityBootstrap: bootstrapWithoutUserId,
      })
      vi.mocked(importIdentitySession).mockResolvedValue({userId: fakeResponse.placeholderAccountUuid})

      await createPreviewStoreCommand({shopName: 'preview-demo'}, () => fixedNow)

      expect(importIdentitySession).toHaveBeenCalledWith(
        expect.objectContaining({userId: fakeResponse.placeholderAccountUuid}),
      )
    })

    test('rejects bootstraps with a non-positive or absurdly long expiry but still persists the store-auth bucket', async () => {
      vi.mocked(createPreviewStore).mockResolvedValue({
        ...bootstrapResponse,
        cliIdentityBootstrap: {...bootstrapResponse.cliIdentityBootstrap, expiresIn: -1},
      })

      const result = await createPreviewStoreCommand({shopName: 'preview-demo'}, () => fixedNow)

      // The validation fires inside the best-effort import block; the shop is
      // still persisted to local storage so the user can `store execute` against it.
      expect(setStoredStoreAppSession).toHaveBeenCalledWith(expect.objectContaining({kind: 'preview'}))
      expect(importIdentitySession).not.toHaveBeenCalled()
      expect(result.identityImported).toBe(false)
    })
  })

  describe('when the orchestrator returns a store_auth_bootstrap', () => {
    test('keys the bucket under the bootstrap shopDomain (the routable Admin API host) and surfaces it as shopPermanentDomain', async () => {
      // Donald's BE returns two distinct domains: `shop_permanent_domain` is the
      // canonical display name (`*.my.shop.dev`) while `store_auth_bootstrap.shop_domain`
      // is where the Admin API is actually served (`*.dev-api.shop.dev` on the rig).
      // On the rig the canonical domain has no Spin routing, so we must use
      // `shopDomain` as the operationally-correct host for bucket lookup AND for
      // building the Admin URL downstream.
      vi.mocked(createPreviewStore).mockResolvedValue({
        ...fakeResponse,
        storeAuthBootstrap: {
          accessToken: 'bootstrap_admin_token',
          scopes: ['read_products', 'write_products'],
          apiKey: 'bootstrap_api_key',
          shopDomain: 'preview-1.dev-api.shop.dev',
        },
      })

      const result = await createPreviewStoreCommand({shopName: 'preview-demo'}, () => fixedNow)

      expect(setStoredStoreAppSession).toHaveBeenCalledWith(
        expect.objectContaining({
          store: 'preview-1.dev-api.shop.dev',
          clientId: 'bootstrap_api_key',
          accessToken: 'bootstrap_admin_token',
          scopes: ['read_products', 'write_products'],
          kind: 'preview',
        }),
      )
      // The result struct surfaces the routable shopDomain so `--json` consumers
      // can pipe directly into `store execute --store ...`.
      expect(result.shopPermanentDomain).toBe('preview-1.dev-api.shop.dev')
    })
  })
})
