import {docSearchService} from './search.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import {shopifyFetch, Response} from '@shopify/cli-kit/node/http'
import {AbortError} from '@shopify/cli-kit/node/error'

vi.mock('@shopify/cli-kit/node/http', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/http')>()),
  shopifyFetch: vi.fn(),
}))

const okResponse = (body: string) => new Response(body)

const errorResponse = (status: number, statusText: string, body: string) => new Response(body, {status, statusText})

const resultsBody =
  '[{"score":0.99,"content":"About webhooks","url":"https://shopify.dev/x","title":"Webhooks","domain":null}]'

beforeEach(() => {
  vi.mocked(shopifyFetch).mockResolvedValue(okResponse(resultsBody))
})

describe('docSearchService', () => {
  test('requests the search endpoint and returns typed chunks and the original body', async () => {
    const result = await docSearchService('webhooks')

    expect(shopifyFetch).toHaveBeenCalledWith('https://shopify.dev/assistant/search?query=webhooks', {
      headers: {Accept: 'application/json', 'X-Shopify-Surface': 'cli'},
    })
    expect(result).toEqual({
      status: 'success',
      results: [
        {score: 0.99, content: 'About webhooks', url: 'https://shopify.dev/x', title: 'Webhooks', domain: null},
      ],
      pageInfo: {hasNextPage: null},
      body: resultsBody,
    })
  })

  test('includes api_name and api_version params when provided', async () => {
    await docSearchService('create a product', 'admin', 'latest')

    expect(shopifyFetch).toHaveBeenCalledWith(
      'https://shopify.dev/assistant/search?query=create+a+product&api_name=admin&api_version=latest',
      {headers: {Accept: 'application/json', 'X-Shopify-Surface': 'cli'}},
    )
  })

  test('URL-encodes queries with spaces and special characters', async () => {
    await docSearchService('a & b?')

    expect(shopifyFetch).toHaveBeenCalledWith('https://shopify.dev/assistant/search?query=a+%26+b%3F', {
      headers: {Accept: 'application/json', 'X-Shopify-Surface': 'cli'},
    })
  })

  test('surfaces the server error message from a non-ok JSON response', async () => {
    vi.mocked(shopifyFetch).mockResolvedValue(
      errorResponse(
        400,
        'Bad Request',
        '{"error":"Invalid api_version \'2025-01\' for api_name \'admin\'. Available versions: 2026-07"}',
      ),
    )

    await expect(docSearchService('products', 'admin', '2025-01')).rejects.toThrowError(
      /Invalid api_version '2025-01' for api_name 'admin'\. Available versions: 2026-07/,
    )
  })

  test('falls back to the status line when a non-ok response is not JSON', async () => {
    vi.mocked(shopifyFetch).mockResolvedValue(errorResponse(500, 'Internal Server Error', '<html>nope</html>'))

    const result = docSearchService('products')
    await expect(result).rejects.toThrowError(AbortError)
    await expect(result).rejects.toThrowError(/500 Internal Server Error/)
  })

  test('reports a friendly error when the request cannot reach shopify.dev', async () => {
    vi.mocked(shopifyFetch).mockRejectedValue(new Error('getaddrinfo ENOTFOUND shopify.dev'))

    await expect(docSearchService('products')).rejects.toThrowError(AbortError)
    await expect(docSearchService('products')).rejects.toThrowError(/Could not reach shopify\.dev/)
  })

  test('returns an empty collection', async () => {
    vi.mocked(shopifyFetch).mockResolvedValue(okResponse('[]'))
    await expect(docSearchService('nothing')).resolves.toEqual({
      status: 'success',
      results: [],
      pageInfo: {hasNextPage: null},
      body: '[]',
    })
  })

  test('projects public fields and normalizes missing domain metadata', async () => {
    const body = '[{"score":0,"content":"","url":"https://shopify.dev/x","title":"Example","internal":"hidden"}]'
    vi.mocked(shopifyFetch).mockResolvedValue(okResponse(body))
    await expect(docSearchService('example')).resolves.toEqual({
      status: 'success',
      results: [{score: 0, content: '', url: 'https://shopify.dev/x', title: 'Example', domain: null}],
      pageInfo: {hasNextPage: null},
      body,
    })
  })

  test.each(['not JSON', 'null', '{}', '[{"url":"https://shopify.dev/x"}]'])(
    'returns an invalid response condition with the original body: %s',
    async (body) => {
      vi.mocked(shopifyFetch).mockResolvedValue(okResponse(body))
      await expect(docSearchService('example')).resolves.toEqual({status: 'invalid-response', body})
    },
  )
})
