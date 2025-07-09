import {FileUploader} from './file-uploader.js'
import {createStagedUploadAdmin} from '../../../apis/admin/index.js'
import {ValidationError, OperationError, ErrorCodes} from '../errors/errors.js'
import {fetch} from '@shopify/cli-kit/node/http'
import {describe, test, expect, vi, beforeEach} from 'vitest'
import {readFileSync, statSync} from 'node:fs'

vi.mock('../../../apis/admin/index.js')
vi.mock('@shopify/cli-kit/node/http')
vi.mock('node:fs')

describe('FileUploader', () => {
  let fileUploader: FileUploader
  const mockFilePath = '/path/to/test.sqlite'
  const mockStoreFqdn = 'test-store.myshopify.com'

  beforeEach(() => {
    fileUploader = new FileUploader()
  })

  describe('uploadSqliteFile', () => {
    const mockFileBuffer = Buffer.from('SQLite format 3\0test data')
    const mockFileStats = {
      isFile: () => true,
      size: 1024,
    }
    const mockStagedUploadResponse = {
      stagedUploadsCreate: {
        stagedTargets: [
          {
            url: 'https://upload.shopify.com/staged',
            resourceUrl: 'https://shopify.com/resource/123',
            parameters: [
              {name: 'key', value: 'uploads/123'},
              {name: 'policy', value: 'policy123'},
            ],
          },
        ],
        userErrors: [],
      },
    }

    beforeEach(() => {
      vi.mocked(statSync).mockReturnValue(mockFileStats as any)
      vi.mocked(readFileSync).mockReturnValue(mockFileBuffer)
      vi.mocked(createStagedUploadAdmin).mockResolvedValue(mockStagedUploadResponse)
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(''),
      } as any)
    })

    test('should successfully upload a valid SQLite file', async () => {
      const result = await fileUploader.uploadSqliteFile(mockFilePath, mockStoreFqdn)

      expect(result).toBe('https://shopify.com/resource/123')
      expect(statSync).toHaveBeenCalledWith(mockFilePath)
      expect(readFileSync).toHaveBeenCalledWith(mockFilePath)
      expect(createStagedUploadAdmin).toHaveBeenCalledWith(mockStoreFqdn, [
        {
          resource: 'FILE',
          filename: 'database.sqlite',
          mimeType: 'application/x-sqlite3',
          httpMethod: 'POST',
          fileSize: '1024',
        },
      ])
      expect(fetch).toHaveBeenCalledWith('https://upload.shopify.com/staged', {
        method: 'POST',
        body: expect.any(FormData),
      })
    })

    test('should throw error when file does not exist', async () => {
      vi.mocked(statSync).mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory')
      })

      const promise = fileUploader.uploadSqliteFile(mockFilePath, mockStoreFqdn)
      await expect(promise).rejects.toThrow(ValidationError)
      await expect(promise).rejects.toMatchObject({
        code: ErrorCodes.FILE_NOT_FOUND,
        params: {filePath: mockFilePath},
      })
    })

    test('should throw error when path is not a file', async () => {
      vi.mocked(statSync).mockReturnValue({
        isFile: () => false,
        size: 1024,
      } as any)

      const promise = fileUploader.uploadSqliteFile(mockFilePath, mockStoreFqdn)
      await expect(promise).rejects.toThrow(ValidationError)
      await expect(promise).rejects.toMatchObject({
        code: ErrorCodes.NOT_A_FILE,
        params: {filePath: mockFilePath},
      })
    })

    test('should throw error when file is empty', async () => {
      vi.mocked(statSync).mockReturnValue({
        isFile: () => true,
        size: 0,
      } as any)

      const promise = fileUploader.uploadSqliteFile(mockFilePath, mockStoreFqdn)
      await expect(promise).rejects.toThrow(ValidationError)
      await expect(promise).rejects.toMatchObject({
        code: ErrorCodes.EMPTY_FILE,
        params: {filePath: mockFilePath},
      })
    })

    test('should throw error when file is too large', async () => {
      // 6GB
      const largeSize = 6 * 1024 * 1024 * 1024
      vi.mocked(statSync).mockReturnValue({
        isFile: () => true,
        size: largeSize,
      } as any)

      const promise = fileUploader.uploadSqliteFile(mockFilePath, mockStoreFqdn)
      await expect(promise).rejects.toThrow(ValidationError)
      await expect(promise).rejects.toMatchObject({
        code: ErrorCodes.FILE_TOO_LARGE,
        params: {filePath: mockFilePath, sizeGB: 6},
      })
    })

    test('should throw error when file is not a valid SQLite database', async () => {
      vi.mocked(readFileSync).mockReturnValue(Buffer.from('Not a SQLite file'))

      const promise = fileUploader.uploadSqliteFile(mockFilePath, mockStoreFqdn)
      await expect(promise).rejects.toThrow(ValidationError)
      await expect(promise).rejects.toMatchObject({
        code: ErrorCodes.INVALID_FILE_FORMAT,
        params: {filePath: mockFilePath},
      })
    })

    test('should throw error when staged upload creation fails with no targets', async () => {
      vi.mocked(createStagedUploadAdmin).mockResolvedValue({
        stagedUploadsCreate: {
          stagedTargets: [],
          userErrors: [],
        },
      })

      const promise = fileUploader.uploadSqliteFile(mockFilePath, mockStoreFqdn)
      await expect(promise).rejects.toThrow(OperationError)
      await expect(promise).rejects.toMatchObject({
        operation: 'upload',
        code: ErrorCodes.STAGED_UPLOAD_FAILED,
      })
    })

    test('should throw error when staged target is null', async () => {
      vi.mocked(createStagedUploadAdmin).mockResolvedValue({
        stagedUploadsCreate: {
          stagedTargets: [null as any],
          userErrors: [],
        },
      })

      const promise = fileUploader.uploadSqliteFile(mockFilePath, mockStoreFqdn)
      await expect(promise).rejects.toThrow(OperationError)
      await expect(promise).rejects.toMatchObject({
        operation: 'upload',
        code: ErrorCodes.STAGED_UPLOAD_FAILED,
      })
    })

    test('should throw error when HTTP upload fails', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: vi.fn().mockResolvedValue('Access denied'),
      } as any)

      const promise = fileUploader.uploadSqliteFile(mockFilePath, mockStoreFqdn)
      await expect(promise).rejects.toThrow(OperationError)
      await expect(promise).rejects.toMatchObject({
        operation: 'upload',
        code: ErrorCodes.FILE_UPLOAD_FAILED,
        params: {details: '403 Forbidden. Access denied'},
      })
    })

    test('should handle non-Error exceptions in validateSqliteFile', async () => {
      vi.mocked(statSync).mockImplementation(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'string error'
      })

      await expect(fileUploader.uploadSqliteFile(mockFilePath, mockStoreFqdn)).rejects.toThrow(ValidationError)
    })
  })
})
