import {agentSearchService} from './agent-search.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import {fetch} from '@shopify/cli-kit/node/http'
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
  vi.mocked(fetch).mockResolvedValue(okResponse(resultsBody))
})

describe('agentSearchService', () => {
  test('requests the search endpoint with the query and prints the raw JSON body', async () => {
    await agentSearchService('webhooks')

    expect(fetch).toHaveBeenCalledWith('https://shopify.dev/assistant/search?query=webhooks', {
      headers: {Accept: 'application/json'},
    })
    expect(outputResult).toHaveBeenCalledWith(resultsBody)
  })

  test('includes api_name and api_version params when provided', async () => {
    await agentSearchService('create a product', 'admin', 'latest')

    expect(fetch).toHaveBeenCalledWith(
      'https://shopify.dev/assistant/search?query=create+a+product&api_name=admin&api_version=latest',
      {headers: {Accept: 'application/json'}},
    )
  })

  test('URL-encodes queries with spaces and special characters', async () => {
    await agentSearchService('a & b?')

    expect(fetch).toHaveBeenCalledWith('https://shopify.dev/assistant/search?query=a+%26+b%3F', {
      headers: {Accept: 'application/json'},
    })
  })

  test('surfaces the server error message from a non-ok JSON response', async () => {
    vi.mocked(fetch).mockResolvedValue(
      errorResponse(
        400,
        'Bad Request',
        '{"error":"Invalid api_version \'2025-01\' for api_name \'admin\'. Available versions: 2026-07"}',
      ),
    )

    await expect(agentSearchService('products', 'admin', '2025-01')).rejects.toThrowError(
      /Invalid api_version '2025-01' for api_name 'admin'\. Available versions: 2026-07/,
    )
    expect(outputResult).not.toHaveBeenCalled()
  })

  test('falls back to the status line when a non-ok response is not JSON', async () => {
    vi.mocked(fetch).mockResolvedValue(errorResponse(500, 'Internal Server Error', '<html>nope</html>'))

    await expect(agentSearchService('products')).rejects.toThrowError(AbortError)
    await expect(agentSearchService('products')).rejects.toThrowError(/500 Internal Server Error/)
    expect(outputResult).not.toHaveBeenCalled()
  })
})
