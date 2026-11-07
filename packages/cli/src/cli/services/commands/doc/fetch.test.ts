import {docFetchService} from './fetch.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import {fetch, Response} from '@shopify/cli-kit/node/http'
import {AbortError} from '@shopify/cli-kit/node/error'

vi.mock('@shopify/cli-kit/node/http', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/http')>()),
  fetch: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(fetch).mockResolvedValue(new Response('# Doc'))
})

describe('docFetchService', () => {
  test('requests Markdown and returns a document', async () => {
    const result = await docFetchService('https://shopify.dev/docs/api/shopify-cli')

    expect(fetch).toHaveBeenCalledWith('https://shopify.dev/docs/api/shopify-cli', {
      headers: {Accept: 'text/markdown', 'X-Shopify-Surface': 'cli'},
    })
    expect(result).toEqual({document: {url: 'https://shopify.dev/docs/api/shopify-cli', content: '# Doc'}})
  })

  test('accepts shopify.dev subdomains', async () => {
    await docFetchService('https://www.shopify.dev/docs')

    expect(fetch).toHaveBeenCalledOnce()
  })

  test('rejects URLs from disallowed hosts without fetching', async () => {
    await expect(docFetchService('https://example.com/docs')).rejects.toThrowError(AbortError)
    expect(fetch).not.toHaveBeenCalled()
  })

  test('rejects malformed URLs without fetching', async () => {
    await expect(docFetchService('not a url')).rejects.toThrowError(AbortError)
    expect(fetch).not.toHaveBeenCalled()
  })

  test('returns an empty document as a valid result', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(''))
    await expect(docFetchService('https://shopify.dev/docs')).resolves.toEqual({
      document: {url: 'https://shopify.dev/docs', content: ''},
    })
  })

  test('sends Accept-Language when a language is provided', async () => {
    await docFetchService('https://shopify.dev/docs/api/shopify-cli', 'ruby')

    expect(fetch).toHaveBeenCalledWith('https://shopify.dev/docs/api/shopify-cli', {
      headers: {Accept: 'text/markdown', 'X-Shopify-Surface': 'cli', 'Accept-Language': 'ruby'},
    })
  })

  test('throws when the response is not ok', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('', {status: 404, statusText: 'Not Found'}))

    const result = docFetchService('https://shopify.dev/missing')
    await expect(result).rejects.toThrowError(AbortError)
    await expect(result).rejects.toThrow('Failed to fetch https://shopify.dev/missing: 404 Not Found')
  })
})
