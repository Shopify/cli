import {ResultFileHandler} from './result-file-handler.js'
import {BulkDataOperationByIdResponse} from '../../../apis/organizations/types.js'
import {FlagOptions} from '../../../lib/types.js'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {renderConfirmationPrompt, renderSuccess, renderTasks} from '@shopify/cli-kit/node/ui'
import {fetch} from '@shopify/cli-kit/node/http'
import {createFileWriteStream} from '@shopify/cli-kit/node/fs'
import {describe, test, expect, vi, beforeEach} from 'vitest'
import {pipeline} from 'node:stream/promises'
import * as zlib from 'node:zlib'
import {Readable, Writable} from 'node:stream'

vi.mock('@shopify/cli-kit/node/output')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/http')
vi.mock('@shopify/cli-kit/node/fs')
vi.mock('node:stream/promises')
vi.mock('node:zlib')

describe('ResultFileHandler', () => {
  let resultFileHandler: ResultFileHandler
  const mockFilePath = '/path/to/result.json'
  const mockDownloadUrl = 'https://shopify.com/download/result.json'
  const mockCompressedUrl = 'https://shopify.com/download/result.json.gz'

  const mockOperation: BulkDataOperationByIdResponse = {
    organization: {
      bulkData: {
        operation: {
          storeOperations: [
            {
              url: mockDownloadUrl,
            },
          ],
        },
      },
    },
  } as any

  const mockFlags: FlagOptions = {
    'no-prompt': false,
  } as any

  beforeEach(() => {
    resultFileHandler = new ResultFileHandler()
  })

  describe('promptAndHandleResultFile', () => {
    test('should output info when no download URL is available', async () => {
      const operationWithoutUrl: BulkDataOperationByIdResponse = {
        organization: {
          bulkData: {
            operation: {
              storeOperations: [],
            },
          },
        },
      } as any

      await resultFileHandler.promptAndHandleResultFile(operationWithoutUrl, 'export', mockFlags, mockFilePath)

      expect(outputInfo).toHaveBeenCalledWith('export completed, but no result file available.')
      expect(renderConfirmationPrompt).not.toHaveBeenCalled()
    })

    test('should download file when user confirms for uncompressed file', async () => {
      vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
      vi.mocked(renderTasks).mockImplementation(async (tasks) => {
        const ctx: any = {}
        for (const task of tasks) {
          // eslint-disable-next-line no-await-in-loop
          await task.task(ctx, task)
        }
        return ctx
      })

      const mockResponseBody = new Readable({
        read() {
          this.push('test data')
          this.push(null)
        },
      })

      vi.mocked(fetch).mockResolvedValue({
        body: mockResponseBody,
      } as any)

      const mockWriteStream = new Writable({
        write(_chunk, _encoding, callback) {
          callback()
        },
      })

      vi.mocked(createFileWriteStream).mockReturnValue(mockWriteStream as any)
      vi.mocked(pipeline).mockResolvedValue()

      await resultFileHandler.promptAndHandleResultFile(mockOperation, 'export', mockFlags, mockFilePath)

      expect(renderConfirmationPrompt).toHaveBeenCalledWith({
        message: 'Press Enter to download the export result file.',
        confirmationMessage: 'Download',
        cancellationMessage: 'Skip',
      })
      expect(fetch).toHaveBeenCalledWith(mockDownloadUrl)
      expect(createFileWriteStream).toHaveBeenCalledWith(mockFilePath)
      expect(pipeline).toHaveBeenCalledWith(mockResponseBody, mockWriteStream)
      expect(renderSuccess).toHaveBeenCalledWith({
        body: [{subdued: 'export result file downloaded to:'}, {filePath: mockFilePath}],
      })
    })

    test('should download and decompress file when URL contains .gz', async () => {
      const compressedOperation = {
        organization: {
          bulkData: {
            operation: {
              storeOperations: [
                {
                  url: mockCompressedUrl,
                },
              ],
            },
          },
        },
      } as any

      vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
      vi.mocked(renderTasks).mockImplementation(async (tasks) => {
        const ctx: any = {}
        for (const task of tasks) {
          // eslint-disable-next-line no-await-in-loop
          await task.task(ctx, task)
        }
        return ctx
      })

      const mockResponseBody = new Readable({
        read() {
          this.push('compressed data')
          this.push(null)
        },
      })

      vi.mocked(fetch).mockResolvedValue({
        body: mockResponseBody,
      } as any)

      const mockWriteStream = new Writable({
        write(_chunk, _encoding, callback) {
          callback()
        },
      })

      const mockGunzip = new Writable({
        write(_chunk, _encoding, callback) {
          callback()
        },
      })

      vi.mocked(createFileWriteStream).mockReturnValue(mockWriteStream as any)
      vi.mocked(zlib.createGunzip).mockReturnValue(mockGunzip as any)
      vi.mocked(pipeline).mockResolvedValue()

      await resultFileHandler.promptAndHandleResultFile(compressedOperation, 'import', mockFlags, mockFilePath)

      expect(zlib.createGunzip).toHaveBeenCalled()
      expect(pipeline).toHaveBeenCalledWith(mockResponseBody, mockGunzip, mockWriteStream)
      expect(renderSuccess).toHaveBeenCalledWith({
        body: [{subdued: 'import result file downloaded to:'}, {filePath: mockFilePath}],
      })
    })

    test('should skip download when user cancels confirmation', async () => {
      vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)

      await resultFileHandler.promptAndHandleResultFile(mockOperation, 'export', mockFlags, mockFilePath)

      expect(renderConfirmationPrompt).toHaveBeenCalled()
      expect(fetch).not.toHaveBeenCalled()
      expect(renderTasks).not.toHaveBeenCalled()
    })

    test('should skip confirmation prompt when no-prompt flag is true', async () => {
      const flagsWithSkip: FlagOptions = {
        'no-prompt': true,
      } as any

      vi.mocked(renderTasks).mockImplementation(async (tasks) => {
        const ctx: any = {}
        for (const task of tasks) {
          // eslint-disable-next-line no-await-in-loop
          await task.task(ctx, task)
        }
        return ctx
      })

      const mockResponseBody = new Readable({
        read() {
          this.push('test data')
          this.push(null)
        },
      })

      vi.mocked(fetch).mockResolvedValue({
        body: mockResponseBody,
      } as any)

      const mockWriteStream = new Writable({
        write(_chunk, _encoding, callback) {
          callback()
        },
      })

      vi.mocked(createFileWriteStream).mockReturnValue(mockWriteStream as any)
      vi.mocked(pipeline).mockResolvedValue()

      await resultFileHandler.promptAndHandleResultFile(mockOperation, 'export', flagsWithSkip, mockFilePath)

      expect(renderConfirmationPrompt).not.toHaveBeenCalled()
      expect(fetch).toHaveBeenCalledWith(mockDownloadUrl)
    })

    test('should throw error when response has no body', async () => {
      vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
      vi.mocked(renderTasks).mockImplementation(async (tasks) => {
        const ctx: any = {}
        for (const task of tasks) {
          // eslint-disable-next-line no-await-in-loop
          await task.task(ctx, task)
        }
        return ctx
      })

      vi.mocked(fetch).mockResolvedValue({
        body: null,
      } as any)

      await expect(
        resultFileHandler.promptAndHandleResultFile(mockOperation, 'export', mockFlags, mockFilePath),
      ).rejects.toThrow('No response body received')
    })
  })
})
