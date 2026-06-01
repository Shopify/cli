import {resolveShopifyDevBaseUrl, searchShopifyDevDocs} from './search.js'
import {fetch as cliFetch} from '@shopify/cli-kit/node/http'
import {describe, expect, test, vi} from 'vitest'

describe('resolveShopifyDevBaseUrl', () => {
  test('uses production by default', () => {
    expect(resolveShopifyDevBaseUrl({})).toEqual({url: 'https://shopify.dev/', headers: {}})
  })

  test('uses shopify-dev when DEV is set', () => {
    expect(resolveShopifyDevBaseUrl({DEV: 'true'})).toEqual({url: 'https://shopify-dev.shop.dev/', headers: {}})
  })

  test('uses staging with Minerva token', () => {
    expect(resolveShopifyDevBaseUrl({SHOPIFY_DEV_STAGING_SERVER_NUMBER: '2', MINERVA_TOKEN: 'token'})).toEqual({
      url: 'https://shopify-dev-staging2.shopifycloud.com/',
      headers: {Cookie: 'MINERVA_TOKEN=token'},
    })
  })
})

describe('searchShopifyDevDocs', () => {
  test('posts to the assistant search endpoint', async () => {
    const response = {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({results: [{title: 'Inventory'}]}),
    } as Awaited<ReturnType<typeof cliFetch>>
    const fetch = vi.fn<typeof cliFetch>(async () => response)

    const result = await searchShopifyDevDocs({query: 'inventory scopes', apiName: 'admin', env: {}, fetch})

    expect(result).toEqual({results: [{title: 'Inventory'}]})
    expect(fetch).toHaveBeenCalledWith(
      'https://shopify.dev/assistant/search',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Shopify-Surface': 'cli',
        }),
        body: JSON.stringify({query: 'inventory scopes', api_name: 'admin'}),
      }),
    )
  })
})
