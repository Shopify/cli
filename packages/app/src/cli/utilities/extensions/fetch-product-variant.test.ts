import {fetchProductVariant} from './fetch-product-variant.js'
import {adminRequest} from '@shopify/cli-kit/node/api/admin'
import {ensureAuthenticatedAdmin} from '@shopify/cli-kit/node/session'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/api/admin')
vi.mock('@shopify/cli-kit/node/session')

describe('fetchProductVariant', () => {
  beforeEach(() => {
    vi.mocked(ensureAuthenticatedAdmin).mockResolvedValue({
      token: 'admin-token',
      storeFqdn: 'test.myshopify.com',
    })
    vi.mocked(adminRequest).mockResolvedValue({
      products: {
        edges: [
          {
            node: {
              variants: {
                edges: [{node: {id: 'gid://shopify/ProductVariant/123'}}],
              },
            },
          },
        ],
      },
    } as any)
  })

  test('authenticates with the default session when no auth session ID is provided', async () => {
    const got = await fetchProductVariant('test.myshopify.com')

    expect(got).toBe('123')
    expect(ensureAuthenticatedAdmin).toHaveBeenCalledWith('test.myshopify.com')
  })

  test('authenticates with the provided auth session ID', async () => {
    const got = await fetchProductVariant('test.myshopify.com', 'session-id-for-work')

    expect(got).toBe('123')
    expect(ensureAuthenticatedAdmin).toHaveBeenCalledWith('test.myshopify.com', [], {
      sessionId: 'session-id-for-work',
    })
  })
})
