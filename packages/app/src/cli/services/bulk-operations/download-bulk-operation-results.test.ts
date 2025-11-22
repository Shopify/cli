import {downloadBulkOperationResults} from './download-bulk-operation-results.js'
import {fetch} from '@shopify/cli-kit/node/http'
import {describe, test, expect, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/http')

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
