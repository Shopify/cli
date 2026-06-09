import {fetchDocService} from './fetch-doc.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import {fetch} from '@shopify/cli-kit/node/http'
import {outputResult} from '@shopify/cli-kit/node/output'
import {AbortError} from '@shopify/cli-kit/node/error'

vi.mock('@shopify/cli-kit/node/http')
vi.mock('@shopify/cli-kit/node/output')

const okResponse = (body: string) =>
  ({ok: true, status: 200, statusText: 'OK', text: () => Promise.resolve(body)}) as any

beforeEach(() => {
  vi.mocked(fetch).mockResolvedValue(okResponse('# Doc'))
})

describe('fetchDocService', () => {
  test('requests Markdown by default and prints the body to stdout', async () => {
    await fetchDocService('https://shopify.dev/docs/api/shopify-cli')

    expect(fetch).toHaveBeenCalledWith('https://shopify.dev/docs/api/shopify-cli', {
      headers: {Accept: 'text/markdown'},
    })
    expect(outputResult).toHaveBeenCalledWith('# Doc')
  })

  test('passes a custom content type through as the Accept header', async () => {
    await fetchDocService('https://shopify.dev/docs/api/shopify-cli', 'text/html')

    expect(fetch).toHaveBeenCalledWith('https://shopify.dev/docs/api/shopify-cli', {
      headers: {Accept: 'text/html'},
    })
  })

  test('accepts shopify.dev subdomains', async () => {
    await fetchDocService('https://www.shopify.dev/docs')

    expect(fetch).toHaveBeenCalledOnce()
  })

  test('rejects URLs from disallowed hosts without fetching', async () => {
    await expect(fetchDocService('https://example.com/docs')).rejects.toThrowError(AbortError)
    expect(fetch).not.toHaveBeenCalled()
  })

  test('rejects malformed URLs without fetching', async () => {
    await expect(fetchDocService('not a url')).rejects.toThrowError(AbortError)
    expect(fetch).not.toHaveBeenCalled()
  })

  test('throws when the response is not ok', async () => {
    vi.mocked(fetch).mockResolvedValue({ok: false, status: 404, statusText: 'Not Found'} as any)

    await expect(fetchDocService('https://shopify.dev/missing')).rejects.toThrowError(AbortError)
    expect(outputResult).not.toHaveBeenCalled()
  })
})
