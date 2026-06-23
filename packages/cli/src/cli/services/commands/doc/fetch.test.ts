import {docFetchService} from './fetch.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import {fetch} from '@shopify/cli-kit/node/http'
import {outputResult} from '@shopify/cli-kit/node/output'
import {AbortError} from '@shopify/cli-kit/node/error'
import {mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {dirname, resolvePath} from '@shopify/cli-kit/node/path'

vi.mock('@shopify/cli-kit/node/http')
vi.mock('@shopify/cli-kit/node/output')
vi.mock('@shopify/cli-kit/node/fs')

const okResponse = (body: string) =>
  ({ok: true, status: 200, statusText: 'OK', text: () => Promise.resolve(body)}) as any

beforeEach(() => {
  vi.mocked(fetch).mockResolvedValue(okResponse('# Doc'))
})

describe('docFetchService', () => {
  test('requests Markdown and prints the body to stdout', async () => {
    await docFetchService('https://shopify.dev/docs/api/shopify-cli')

    expect(fetch).toHaveBeenCalledWith('https://shopify.dev/docs/api/shopify-cli', {
      headers: {Accept: 'text/markdown', 'X-Shopify-Surface': 'cli'},
    })
    expect(outputResult).toHaveBeenCalledWith('# Doc')
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

  test('writes the document to the output path instead of stdout', async () => {
    await docFetchService('https://shopify.dev/docs/api/shopify-cli', 'docs/shopify-cli.md')

    const expectedPath = resolvePath('docs/shopify-cli.md')
    expect(mkdir).toHaveBeenCalledWith(dirname(expectedPath))
    expect(writeFile).toHaveBeenCalledWith(expectedPath, '# Doc')
    expect(outputResult).not.toHaveBeenCalled()
  })

  test('throws when the response is not ok', async () => {
    vi.mocked(fetch).mockResolvedValue({ok: false, status: 404, statusText: 'Not Found'} as any)

    await expect(docFetchService('https://shopify.dev/missing')).rejects.toThrowError(AbortError)
    expect(outputResult).not.toHaveBeenCalled()
  })
})
