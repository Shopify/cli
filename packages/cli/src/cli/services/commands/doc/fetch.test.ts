import {docFetchService} from './fetch.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import {fetch} from '@shopify/cli-kit/node/http'
import {outputResult} from '@shopify/cli-kit/node/output'
import {AbortError} from '@shopify/cli-kit/node/error'
import {inTemporaryDirectory, readFile, fileExistsSync} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {addPublicMetadata} from '@shopify/cli-kit/node/metadata'

vi.mock('@shopify/cli-kit/node/http')
vi.mock('@shopify/cli-kit/node/output')
vi.mock('@shopify/cli-kit/node/metadata')

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

  test('records the fetched URL path, without query or fragment, in command analytics', async () => {
    await docFetchService(
      'https://shopify.dev/docs/apps/launch/app-store-review/app-store-ai-self-review-requirements?utm=x#top',
    )

    expect(addPublicMetadata).toHaveBeenCalledTimes(1)
    expect(vi.mocked(addPublicMetadata).mock.calls[0]![0]()).toEqual({
      cmd_doc_fetch_url_path: '/docs/apps/launch/app-store-review/app-store-ai-self-review-requirements',
    })
  })

  test('accepts shopify.dev subdomains', async () => {
    await docFetchService('https://www.shopify.dev/docs')

    expect(fetch).toHaveBeenCalledOnce()
  })

  test('rejects URLs from disallowed hosts without fetching', async () => {
    await expect(docFetchService('https://example.com/docs')).rejects.toThrowError(AbortError)
    expect(fetch).not.toHaveBeenCalled()
    expect(addPublicMetadata).not.toHaveBeenCalled()
  })

  test('rejects malformed URLs without fetching', async () => {
    await expect(docFetchService('not a url')).rejects.toThrowError(AbortError)
    expect(fetch).not.toHaveBeenCalled()
  })

  test('writes the document to the output path instead of stdout', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const outputPath = joinPath(tmpDir, 'docs/shopify-cli.md')

      // When
      await docFetchService('https://shopify.dev/docs/api/shopify-cli', outputPath)

      // Then
      expect(fileExistsSync(outputPath)).toBe(true)
      await expect(readFile(outputPath)).resolves.toBe('# Doc')
      expect(outputResult).not.toHaveBeenCalled()
    })
  })

  test('sends Accept-Language when a language is provided', async () => {
    await docFetchService('https://shopify.dev/docs/api/shopify-cli', undefined, 'ruby')

    expect(fetch).toHaveBeenCalledWith('https://shopify.dev/docs/api/shopify-cli', {
      headers: {Accept: 'text/markdown', 'X-Shopify-Surface': 'cli', 'Accept-Language': 'ruby'},
    })
  })

  test('throws when the response is not ok', async () => {
    vi.mocked(fetch).mockResolvedValue({ok: false, status: 404, statusText: 'Not Found'} as any)

    await expect(docFetchService('https://shopify.dev/missing')).rejects.toThrowError(AbortError)
    expect(outputResult).not.toHaveBeenCalled()
  })
})
