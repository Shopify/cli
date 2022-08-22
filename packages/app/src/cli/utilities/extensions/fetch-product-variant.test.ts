import {fetchProductVariant} from './fetch-product-variant.js'
import {session, api} from '@shopify/cli-kit'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {okAsync} from '@shopify/cli-kit/common/typing/result/result-async'

beforeEach(() => {
  vi.mock('@shopify/cli-kit', async () => {
    const cliKit: any = await vi.importActual('@shopify/cli-kit')
    return {
      ...cliKit,
      session: {
        ensureAuthenticatedAdmin: vi.fn(),
      },
      api: {
        admin: {
          request: vi.fn(),
        },
        graphql: {
          FindProductVariantQuery: vi.fn(),
        },
      },
    }
  })
  vi.mock('@shopify/cli-kit/node/node-package-manager')
})

describe('fetchProductVariant', () => {
  it('throw an exception when ensureAuthenticatedAdmin fails', async () => {
    // Given
    const ensureAuthenticatedAdminError = new Error()
    vi.mocked(session.ensureAuthenticatedAdmin).mockRejectedValue(ensureAuthenticatedAdminError)

    // When
    const result = fetchProductVariant('store')

    // Then
    await expect(result).rejects.toThrow(ensureAuthenticatedAdminError)
  })

  it('throw an Abort exception when Products API request returns zero products', async () => {
    // Given
    vi.mocked(session.ensureAuthenticatedAdmin).mockResolvedValue({
      token: '',
      storeFqdn: '',
    })
    vi.mocked(api.admin.request).mockReturnValue(
      okAsync({
        products: {
          edges: [],
        },
      }),
    )

    // When
    const result = fetchProductVariant('store')

    // Then
    await expect(result).rejects.toThrow('Could not find a product variant')
  })

  it('get product variant when Products API request returns at least one product', async () => {
    // Given
    vi.mocked(session.ensureAuthenticatedAdmin).mockResolvedValue({
      token: '',
      storeFqdn: '',
    })
    vi.mocked(api.admin.request).mockReturnValue(
      okAsync({
        products: {
          edges: [
            {
              node: {
                variants: {
                  edges: [
                    {
                      node: {
                        id: 'product/variantId',
                      },
                    },
                  ],
                },
              },
            },
          ],
        },
      }),
    )

    // When
    const result = fetchProductVariant('store')

    // Then
    await expect(result).resolves.toEqual('variantId')
  })
})
