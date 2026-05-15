import {importPreviewStoreBootstrap} from './bootstrap.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {importIdentitySession} from '@shopify/cli-kit/node/session'
import {importStoreAuthBootstrap} from '@shopify/store'

vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/store', () => ({
  importStoreAuthBootstrap: vi.fn(),
}))

describe('importPreviewStoreBootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  test('imports both CLI identity and stored store auth from preview create response', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-14T12:00:00.000Z'))
    vi.mocked(importIdentitySession).mockResolvedValueOnce({userId: 'placeholder-user-id'})

    const result = await importPreviewStoreBootstrap({
      shop_id: 1,
      shop_permanent_domain: 'preview-shop.my.shop.dev',
      placeholder_account_uuid: 'placeholder-user-id',
      admin_api_token: 'admin-token',
      magic_link_url: 'https://example.com/magic-link',
      cli_identity_bootstrap: {
        access_token: 'identity-token',
        refresh_token: 'refresh-token',
        expires_in: 1800,
        user_id: 'placeholder-user-id',
      },
      store_auth_bootstrap: {
        access_token: 'store-token',
        scopes: ['read_products'],
        api_key: 'development-shop-merchant-key',
        shop_domain: 'preview-shop.dev-api.shop.dev',
      },
    })

    expect(result).toEqual({identityImported: true, storeAuthImported: true})
    expect(importIdentitySession).toHaveBeenCalledWith({
      accessToken: 'identity-token',
      refreshToken: 'refresh-token',
      expiresAt: new Date('2026-05-14T12:30:00.000Z'),
      userId: 'placeholder-user-id',
    })
    expect(importStoreAuthBootstrap).toHaveBeenCalledWith({
      userId: 'placeholder-user-id',
      bootstrap: {
        accessToken: 'store-token',
        scopes: ['read_products'],
        apiKey: 'development-shop-merchant-key',
        shopDomain: 'preview-shop.dev-api.shop.dev',
      },
    })

    vi.useRealTimers()
  })

  test('falls back to the placeholder account uuid when backend omits cli_identity_bootstrap.user_id', async () => {
    vi.mocked(importIdentitySession).mockResolvedValueOnce({userId: 'placeholder-uuid'})

    await importPreviewStoreBootstrap({
      shop_id: 1,
      shop_permanent_domain: 'preview-shop.my.shop.dev',
      placeholder_account_uuid: 'placeholder-uuid',
      admin_api_token: 'admin-token',
      magic_link_url: 'https://example.com/magic-link',
      cli_identity_bootstrap: {
        access_token: 'identity-token',
        refresh_token: 'refresh-token',
        expires_in: 1800,
      },
    })

    expect(importIdentitySession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'placeholder-uuid',
      }),
    )
  })

  test('rejects invalid identity bootstrap expiry values', async () => {
    await expect(
      importPreviewStoreBootstrap({
        shop_id: 1,
        shop_permanent_domain: 'preview-shop.my.shop.dev',
        placeholder_account_uuid: 'placeholder-user-id',
        admin_api_token: 'admin-token',
        magic_link_url: 'https://example.com/magic-link',
        cli_identity_bootstrap: {
          access_token: 'identity-token',
          refresh_token: 'refresh-token',
          expires_in: 0,
          user_id: 'placeholder-user-id',
        },
      }),
    ).rejects.toThrow('Preview store returned an invalid CLI identity bootstrap expiry.')
  })

  test('does nothing when preview create returns no bootstrap payloads', async () => {
    const result = await importPreviewStoreBootstrap({
      shop_id: 1,
      shop_permanent_domain: 'preview-shop.my.shop.dev',
      placeholder_account_uuid: 'placeholder-user-id',
      admin_api_token: 'admin-token',
      magic_link_url: 'https://example.com/magic-link',
    })

    expect(result).toEqual({identityImported: false, storeAuthImported: false})
    expect(importIdentitySession).not.toHaveBeenCalled()
    expect(importStoreAuthBootstrap).not.toHaveBeenCalled()
  })
})
