import {docSearchService} from './search.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import {shopifyFetch} from '@shopify/cli-kit/node/http'
import {outputResult} from '@shopify/cli-kit/node/output'
import {AbortError} from '@shopify/cli-kit/node/error'

vi.mock('@shopify/cli-kit/node/http')
// Only stub `outputResult`; keep the rest of the module real. Blanket-mocking it
// would also mock `stringifyMessage`, which `AbortError`'s constructor relies on —
// that would silently empty out every thrown error message.
vi.mock('@shopify/cli-kit/node/output', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/output')>()),
  outputResult: vi.fn(),
}))

const okResponse = (body: string) =>
  ({ok: true, status: 200, statusText: 'OK', text: () => Promise.resolve(body)}) as any

const errorResponse = (status: number, statusText: string, body: string) =>
  ({ok: false, status, statusText, text: () => Promise.resolve(body)}) as any

const resultsBody =
  '[{"score":0.99,"content":"About webhooks","url":"https://shopify.dev/x","title":"Webhooks","domain":null}]'

beforeEach(() => {
  vi.mocked(shopifyFetch).mockResolvedValue(okResponse(resultsBody))
})

describe('docSearchService', () => {
  test('requests the search endpoint with the query and prints the raw JSON body', async () => {
    await docSearchService('webhooks')

    expect(shopifyFetch).toHaveBeenCalledWith('https://shopify.dev/assistant/search?query=webhooks', {
      headers: {Accept: 'application/json', 'X-Shopify-Surface': 'cli'},
    })
    expect(outputResult).toHaveBeenCalledWith(resultsBody)
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
    expect(outputResult).not.toHaveBeenCalled()
  })

  test('falls back to the status line when a non-ok response is not JSON', async () => {
    vi.mocked(shopifyFetch).mockResolvedValue(errorResponse(500, 'Internal Server Error', '<html>nope</html>'))

    await expect(docSearchService('products')).rejects.toThrowError(AbortError)
    await expect(docSearchService('products')).rejects.toThrowError(/500 Internal Server Error/)
    expect(outputResult).not.toHaveBeenCalled()
  })

  test('reports a friendly error when the request cannot reach shopify.dev', async () => {
    vi.mocked(shopifyFetch).mockRejectedValue(new Error('getaddrinfo ENOTFOUND shopify.dev'))

    await expect(docSearchService('products')).rejects.toThrowError(AbortError)
    await expect(docSearchService('products')).rejects.toThrowError(/Could not reach shopify\.dev/)
    expect(outputResult).not.toHaveBeenCalled()
  })
})
