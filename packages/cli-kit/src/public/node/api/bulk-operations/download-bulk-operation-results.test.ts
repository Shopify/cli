import {downloadBulkOperationResults, resultsContainUserErrors} from './download-bulk-operation-results.js'
import {fetch} from '../../http.js'
import {describe, test, expect, vi} from 'vitest'

vi.mock('../../http.js')

describe('downloadBulkOperationResults', () => {
  test('returns text content when fetch is successful', async () => {
    const mockUrl = 'https://example.com/results.jsonl'
    const mockContent = '{"id":"gid://shopify/Product/123"}\n{"id":"gid://shopify/Product/456"}'

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () => mockContent,
    } as Awaited<ReturnType<typeof fetch>>)

    const result = await downloadBulkOperationResults(mockUrl)

    expect(fetch).toHaveBeenCalledWith(mockUrl)
    expect(result).toBe(mockContent)
  })

  test('throws error when fetch fails', async () => {
    const mockUrl = 'https://example.com/results.jsonl'

    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      statusText: 'Not Found',
    } as Awaited<ReturnType<typeof fetch>>)

    await expect(downloadBulkOperationResults(mockUrl)).rejects.toThrow(
      'Failed to download bulk operation results: Not Found',
    )
  })
})

describe('resultsContainUserErrors', () => {
  test('returns false for an empty result file', () => {
    expect(resultsContainUserErrors('')).toBe(false)
    expect(resultsContainUserErrors('   \n  \n')).toBe(false)
  })

  test('returns false when no line reports user errors', () => {
    const results = '{"data":{"productUpdate":{"product":{"id":"gid://shopify/Product/1"},"userErrors":[]}}}'
    expect(resultsContainUserErrors(results)).toBe(false)
  })

  test('returns true when a line reports user errors', () => {
    const results = [
      '{"data":{"productUpdate":{"product":null,"userErrors":[{"message":"Invalid"}]}}}',
      '{"data":{"productUpdate":{"product":{"id":"gid://shopify/Product/2"},"userErrors":[]}}}',
    ].join('\n')
    expect(resultsContainUserErrors(results)).toBe(true)
  })

  test('ignores lines without a data field', () => {
    expect(resultsContainUserErrors('{"foo":"bar"}')).toBe(false)
  })
})
