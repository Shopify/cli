import {resolveStore} from './store-resolution.js'
import {businessPlatformRequestDoc} from '@shopify/cli-kit/node/api/business-platform'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'
import {encodeGid} from '@shopify/cli-kit/common/gid'
import {describe, test, expect, vi, beforeEach} from 'vitest'

vi.mock('@shopify/cli-kit/node/api/business-platform')
vi.mock('@shopify/cli-kit/node/session')

const SHOP = 'shop.myshopify.com'

// BP's DestinationPublicID input scalar expects a base64-encoded `gid://organization/ShopifyShop/<id>`.
// Compute the expected value dynamically rather than hardcoding the base64 string.
const ENCODED_123 = encodeGid('gid://organization/ShopifyShop/123')

function destinationResponse(fields: {webUrl?: string | null; primaryDomain?: string | null}) {
  return {currentUserAccount: {destination: {webUrl: fields.webUrl, primaryDomain: fields.primaryDomain}}}
}

describe('resolveStore', () => {
  beforeEach(() => {
    vi.mocked(ensureAuthenticatedBusinessPlatform).mockResolvedValue('bp-token')
  })

  describe('domain inputs (no network)', () => {
    test.each([
      ['shop.myshopify.com', 'shop.myshopify.com'],
      ['shop', 'shop.myshopify.com'],
      ['https://shop.myshopify.com/admin', 'shop.myshopify.com'],
      // normalizeStoreFqdn does not lowercase the subdomain; resolveStore must preserve
      // that exact behavior for domain inputs.
      ['SHOP', 'SHOP.myshopify.com'],
    ])('%s resolves to %s without any BP calls', async (input, expected) => {
      const result = await resolveStore(input)

      expect(result).toBe(expected)
      expect(businessPlatformRequestDoc).not.toHaveBeenCalled()
    })
  })

  describe('numeric store ID', () => {
    test('resolves via a single destinations lookup keyed by the encoded shop id', async () => {
      vi.mocked(businessPlatformRequestDoc).mockResolvedValueOnce(
        destinationResponse({webUrl: `https://${SHOP}`, primaryDomain: `https://${SHOP}`}) as never,
      )

      const result = await resolveStore('123')

      expect(result).toBe(SHOP)
      expect(businessPlatformRequestDoc).toHaveBeenCalledTimes(1)
      expect(vi.mocked(businessPlatformRequestDoc).mock.calls[0]?.[0]).toMatchObject({
        variables: {id: ENCODED_123},
      })
    })

    test('prefers webUrl over a custom primaryDomain', async () => {
      vi.mocked(businessPlatformRequestDoc).mockResolvedValueOnce(
        destinationResponse({webUrl: `https://${SHOP}`, primaryDomain: 'https://www.custom-domain.com'}) as never,
      )

      const result = await resolveStore('123')

      expect(result).toBe(SHOP)
    })

    test('falls back to primaryDomain when webUrl yields no host', async () => {
      vi.mocked(businessPlatformRequestDoc).mockResolvedValueOnce(
        destinationResponse({webUrl: null, primaryDomain: `https://${SHOP}`}) as never,
      )

      const result = await resolveStore('123')

      expect(result).toBe(SHOP)
    })

    test('strips scheme and trailing slash from the returned domain', async () => {
      vi.mocked(businessPlatformRequestDoc).mockResolvedValueOnce(
        destinationResponse({webUrl: `https://${SHOP}/`, primaryDomain: null}) as never,
      )

      const result = await resolveStore('123')

      expect(result).toBe(SHOP)
    })

    test('returns a bare-host webUrl (no scheme) as-is', async () => {
      vi.mocked(businessPlatformRequestDoc).mockResolvedValueOnce(
        destinationResponse({webUrl: SHOP, primaryDomain: null}) as never,
      )

      const result = await resolveStore('123')

      expect(result).toBe(SHOP)
    })

    test('throws AbortError mentioning the id when the destination is null', async () => {
      vi.mocked(businessPlatformRequestDoc).mockResolvedValueOnce({currentUserAccount: {destination: null}} as never)

      const err = await resolveStore('999').catch((error: unknown) => error)

      expect(err).toBeInstanceOf(AbortError)
      expect((err as AbortError).message).toContain('999')
      expect((err as AbortError).message).toContain("Couldn't find")
    })

    test('throws AbortError mentioning the id when currentUserAccount is null', async () => {
      vi.mocked(businessPlatformRequestDoc).mockResolvedValueOnce({currentUserAccount: null} as never)

      const err = await resolveStore('999').catch((error: unknown) => error)

      expect(err).toBeInstanceOf(AbortError)
      expect((err as AbortError).message).toContain('999')
      expect((err as AbortError).message).toContain("Couldn't find")
    })

    test('throws a distinct AbortError when the store is found but has no domain', async () => {
      vi.mocked(businessPlatformRequestDoc).mockResolvedValueOnce(
        destinationResponse({webUrl: null, primaryDomain: null}) as never,
      )

      const err = await resolveStore('123').catch((error: unknown) => error)

      expect(err).toBeInstanceOf(AbortError)
      expect((err as AbortError).message).toContain("couldn't determine its domain")
    })

    test('surfaces an auth failure as an AbortError mentioning the id', async () => {
      vi.mocked(ensureAuthenticatedBusinessPlatform).mockRejectedValueOnce(new Error('boom'))

      const err = await resolveStore('123').catch((error: unknown) => error)

      expect(err).toBeInstanceOf(AbortError)
      expect((err as AbortError).message).toContain('123')
      expect((err as AbortError).message).toContain("Couldn't reach the Business Platform")
    })

    test('surfaces a request failure as an AbortError mentioning the id', async () => {
      vi.mocked(businessPlatformRequestDoc).mockRejectedValueOnce(new Error('network error'))

      const err = await resolveStore('123').catch((error: unknown) => error)

      expect(err).toBeInstanceOf(AbortError)
      expect((err as AbortError).message).toContain('123')
      expect((err as AbortError).message).toContain("Couldn't reach the Business Platform")
    })

    test('trims surrounding whitespace before resolving a numeric id', async () => {
      vi.mocked(businessPlatformRequestDoc).mockResolvedValueOnce(
        destinationResponse({webUrl: `https://${SHOP}`, primaryDomain: null}) as never,
      )

      const result = await resolveStore('  123  ')

      expect(result).toBe(SHOP)
      expect(vi.mocked(businessPlatformRequestDoc).mock.calls[0]?.[0]).toMatchObject({
        variables: {id: ENCODED_123},
      })
    })
  })

  describe('GID inputs', () => {
    test('gid://shopify/Shop/<id> resolves the same as the numeric id', async () => {
      vi.mocked(businessPlatformRequestDoc).mockResolvedValueOnce(
        destinationResponse({webUrl: `https://${SHOP}`, primaryDomain: null}) as never,
      )

      const result = await resolveStore('gid://shopify/Shop/123')

      expect(result).toBe(SHOP)
      expect(vi.mocked(businessPlatformRequestDoc).mock.calls[0]?.[0]).toMatchObject({
        variables: {id: ENCODED_123},
      })
    })

    test('lowercase gid://shopify/shop/<id> is accepted', async () => {
      vi.mocked(businessPlatformRequestDoc).mockResolvedValueOnce(
        destinationResponse({webUrl: `https://${SHOP}`, primaryDomain: null}) as never,
      )

      const result = await resolveStore('gid://shopify/shop/123')

      expect(result).toBe(SHOP)
    })

    test('non-Shop GID throws AbortError without any BP calls', async () => {
      const err = await resolveStore('gid://shopify/Product/1').catch((error: unknown) => error)

      expect(err).toBeInstanceOf(AbortError)
      expect(businessPlatformRequestDoc).not.toHaveBeenCalled()
    })

    test('malformed GID throws AbortError without any BP calls', async () => {
      const err = await resolveStore('gid://shopify/Shop/').catch((error: unknown) => error)

      expect(err).toBeInstanceOf(AbortError)
      expect(businessPlatformRequestDoc).not.toHaveBeenCalled()
    })

    test('GID with extra path segments throws AbortError without any BP calls', async () => {
      const err = await resolveStore('gid://shopify/Shop/123/456').catch((error: unknown) => error)

      expect(err).toBeInstanceOf(AbortError)
      expect(businessPlatformRequestDoc).not.toHaveBeenCalled()
    })

    test('trims surrounding whitespace before resolving a GID', async () => {
      vi.mocked(businessPlatformRequestDoc).mockResolvedValueOnce(
        destinationResponse({webUrl: `https://${SHOP}`, primaryDomain: null}) as never,
      )

      const result = await resolveStore('  gid://shopify/Shop/123  ')

      expect(result).toBe(SHOP)
      expect(vi.mocked(businessPlatformRequestDoc).mock.calls[0]?.[0]).toMatchObject({
        variables: {id: ENCODED_123},
      })
    })
  })
})
