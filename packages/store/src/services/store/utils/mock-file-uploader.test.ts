import {MockFileUploader} from './mock-file-uploader.js'
import {fileExists} from '@shopify/cli-kit/node/fs'
import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest'

vi.mock('@shopify/cli-kit/node/fs')

describe('MockFileUploader', () => {
  let mockFileUploader: MockFileUploader
  const mockFilePath = '/path/to/test.sqlite'
  const mockStoreFqdn = 'test-store.myshopify.com'

  beforeEach(() => {
    mockFileUploader = new MockFileUploader()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('uploadSqliteFile', () => {
    test('should successfully mock upload with delay and return unique URL', async () => {
      vi.mocked(fileExists).mockResolvedValue(true)

      const uploadPromise = mockFileUploader.uploadSqliteFile(mockFilePath, mockStoreFqdn)

      // Fast-forward time to skip the delay
      await vi.advanceTimersByTimeAsync(1000)

      const result = await uploadPromise

      expect(result).toMatch(/^https:\/\/mock-staged-uploads\.shopify\.com\/files\/database-\d+\.sqlite$/)
      expect(fileExists).toHaveBeenCalledWith(mockFilePath)
    })

    test('should throw error when file does not exist', async () => {
      vi.mocked(fileExists).mockResolvedValue(false)

      await expect(mockFileUploader.uploadSqliteFile(mockFilePath, mockStoreFqdn)).rejects.toThrow(
        `File ${mockFilePath} not found.`,
      )
    })

    test('should generate different URLs for different timestamps', async () => {
      vi.mocked(fileExists).mockResolvedValue(true)

      // First upload
      const firstPromise = mockFileUploader.uploadSqliteFile(mockFilePath, mockStoreFqdn)
      await vi.advanceTimersByTimeAsync(1000)
      const firstResult = await firstPromise

      // Advance real time to ensure different timestamp
      vi.useRealTimers()
      await new Promise((resolve) => setTimeout(resolve, 10))
      vi.useFakeTimers()

      // Second upload with different time
      const secondPromise = mockFileUploader.uploadSqliteFile(mockFilePath, mockStoreFqdn)
      await vi.advanceTimersByTimeAsync(1000)
      const secondResult = await secondPromise

      expect(firstResult).not.toBe(secondResult)
      expect(firstResult).toMatch(/^https:\/\/mock-staged-uploads\.shopify\.com\/files\/database-\d+\.sqlite$/)
      expect(secondResult).toMatch(/^https:\/\/mock-staged-uploads\.shopify\.com\/files\/database-\d+\.sqlite$/)
    })
  })
})
