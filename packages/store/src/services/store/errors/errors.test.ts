import {ValidationError, OperationError, ErrorCodes} from './errors.js'
import {describe, test, expect} from 'vitest'

describe('ValidationError', () => {
  test('should create error with code and params', () => {
    const error = new ValidationError(ErrorCodes.FILE_NOT_FOUND, {filePath: '/test/file.sqlite'})

    expect(error).toBeInstanceOf(ValidationError)
    expect(error.code).toBe(ErrorCodes.FILE_NOT_FOUND)
    expect(error.params).toEqual({filePath: '/test/file.sqlite'})
    expect(error.message).toBe('File "/test/file.sqlite" not found.')
  })

  test('should create error with code only', () => {
    const error = new ValidationError(ErrorCodes.SAME_SHOP)

    expect(error).toBeInstanceOf(ValidationError)
    expect(error.code).toBe(ErrorCodes.SAME_SHOP)
    expect(error.params).toBeUndefined()
    expect(error.message).toBe('Source and target shops must not be the same.')
  })

  test('should handle SHOP_NOT_FOUND with params', () => {
    const error = new ValidationError(ErrorCodes.SHOP_NOT_FOUND, {shop: 'test-shop.myshopify.com'})

    expect(error.code).toBe(ErrorCodes.SHOP_NOT_FOUND)
    expect(error.params).toEqual({shop: 'test-shop.myshopify.com'})
    expect(error.message).toBe(
      'Shop "test-shop.myshopify.com" not found in any of the Early Access enabled organizations you have access to.',
    )
  })
})

describe('OperationError', () => {
  test('should create error with operation, code, and params', () => {
    const error = new OperationError('import', ErrorCodes.BULK_OPERATION_FAILED, {
      errors: 'Invalid configuration',
      operationType: 'import',
    })

    expect(error).toBeInstanceOf(OperationError)
    expect(error.operation).toBe('import')
    expect(error.code).toBe(ErrorCodes.BULK_OPERATION_FAILED)
    expect(error.params).toEqual({
      errors: 'Invalid configuration',
      operationType: 'import',
    })
    expect(error.message).toBe('Failed to start import operation: Invalid configuration')
  })

  test('should create error without params', () => {
    const error = new OperationError('export', ErrorCodes.EXPORT_FAILED)

    expect(error).toBeInstanceOf(OperationError)
    expect(error.operation).toBe('export')
    expect(error.code).toBe(ErrorCodes.EXPORT_FAILED)
    expect(error.params).toBeUndefined()
    expect(error.message).toBe('Export failed')
  })
})

describe('Error message generation', () => {
  test('should generate correct messages for all error codes', () => {
    // Validation errors
    expect(
      new ValidationError(ErrorCodes.FILE_TOO_LARGE, {filePath: '/test.db', fileSize: '5MB', maxSize: '4MB'}).message,
    ).toBe('File "/test.db" (5MB) exceeds maximum size of 4MB.')
    expect(new ValidationError(ErrorCodes.EMPTY_FILE, {filePath: '/test.db'}).message).toBe('File "/test.db" is empty.')
    expect(new ValidationError(ErrorCodes.NOT_A_FILE, {filePath: '/test'}).message).toBe('Path "/test" is not a file.')
    expect(new ValidationError(ErrorCodes.DIFFERENT_ORG).message).toBe(
      'Source and target shops must be in the same organization.',
    )

    // Operation errors
    expect(new OperationError('copy', ErrorCodes.COPY_FAILED).message).toBe('Copy failed')
    expect(new OperationError('import', ErrorCodes.IMPORT_FAILED).message).toBe('Import failed')
    expect(new OperationError('download', ErrorCodes.FILE_DOWNLOAD_FAILED).message).toBe('No response body received')
    expect(new OperationError('upload', ErrorCodes.FILE_UPLOAD_FAILED, {details: '403 Forbidden'}).message).toBe(
      'File upload failed: 403 Forbidden',
    )
    expect(new OperationError('upload', ErrorCodes.STAGED_UPLOAD_FAILED, {reason: 'Network error'}).message).toBe(
      'Network error',
    )
    expect(new OperationError('upload', ErrorCodes.STAGED_UPLOAD_FAILED).message).toBe('Failed to create staged upload')

    // Unauthorized errors
    expect(
      new OperationError('export', ErrorCodes.UNAUTHORIZED_EXPORT, {storeName: 'test-store.myshopify.com'}).message,
    ).toBe(
      "You are not authorized to export bulk data from store \"test-store.myshopify.com\"\n\nTo export you'll need the 'bulk data > export' permission",
    )
    expect(
      new OperationError('import', ErrorCodes.UNAUTHORIZED_IMPORT, {storeName: 'test-store.myshopify.com'}).message,
    ).toBe(
      "You are not authorized to import bulk data to store \"test-store.myshopify.com\"\n\nTo import you'll need the 'bulk data > import' permission",
    )
    expect(
      new OperationError('copy', ErrorCodes.UNAUTHORIZED_COPY, {
        sourceStoreName: 'source.myshopify.com',
        targetStoreName: 'target.myshopify.com',
      }).message,
    ).toBe(
      "You are not authorized to copy data between these stores\n\nTo export data from \"source.myshopify.com\"\n• You'll need the 'bulk data > export' permission\n\nTo import data to \"target.myshopify.com\"\n• You'll need the 'bulk data > import' permission",
    )
  })

  test('should generate correct GRAPHQL_API_ERROR messages with request IDs', () => {
    expect(new OperationError('fetchOrgs', ErrorCodes.GRAPHQL_API_ERROR, {}, 'req-123').message).toBe(
      'Copy could not complete due to an API request failure\n\nRequest Id: req-123',
    )
    expect(new OperationError('fetchOrgs', ErrorCodes.GRAPHQL_API_ERROR).message).toBe(
      'Copy could not complete due to an API request failure\n\nRequest Id: unknown',
    )
  })
})

describe('OperationError with Request ID', () => {
  test('should create error with request ID', () => {
    const error = new OperationError('api', ErrorCodes.GRAPHQL_API_ERROR, {}, 'test-request-456')

    expect(error).toBeInstanceOf(OperationError)
    expect(error.operation).toBe('api')
    expect(error.code).toBe(ErrorCodes.GRAPHQL_API_ERROR)
    expect(error.requestId).toBe('test-request-456')
    expect(error.message).toContain('Request Id: test-request-456')
  })

  test('should create error without request ID', () => {
    const error = new OperationError('api', ErrorCodes.GRAPHQL_API_ERROR)

    expect(error).toBeInstanceOf(OperationError)
    expect(error.requestId).toBeUndefined()
    expect(error.message).toContain('Request Id: unknown')
  })
})

describe('Unauthorized Error Codes', () => {
  test('should create UNAUTHORIZED_EXPORT error with store name', () => {
    const error = new OperationError('startBulkDataStoreExport', ErrorCodes.UNAUTHORIZED_EXPORT, {
      storeName: 'test-store.myshopify.com',
    })

    expect(error).toBeInstanceOf(OperationError)
    expect(error.operation).toBe('startBulkDataStoreExport')
    expect(error.code).toBe(ErrorCodes.UNAUTHORIZED_EXPORT)
    expect(error.params).toEqual({storeName: 'test-store.myshopify.com'})
    expect(error.message).toBe(
      "You are not authorized to export bulk data from store \"test-store.myshopify.com\"\n\nTo export you'll need the 'bulk data > export' permission",
    )
  })

  test('should create UNAUTHORIZED_IMPORT error with store name', () => {
    const error = new OperationError('startBulkDataStoreImport', ErrorCodes.UNAUTHORIZED_IMPORT, {
      storeName: 'target-store.myshopify.com',
    })

    expect(error).toBeInstanceOf(OperationError)
    expect(error.operation).toBe('startBulkDataStoreImport')
    expect(error.code).toBe(ErrorCodes.UNAUTHORIZED_IMPORT)
    expect(error.params).toEqual({storeName: 'target-store.myshopify.com'})
    expect(error.message).toBe(
      "You are not authorized to import bulk data to store \"target-store.myshopify.com\"\n\nTo import you'll need the 'bulk data > import' permission",
    )
  })

  test('should create UNAUTHORIZED_COPY error with source and target store names', () => {
    const error = new OperationError('startBulkDataStoreCopy', ErrorCodes.UNAUTHORIZED_COPY, {
      sourceStoreName: 'source.myshopify.com',
      targetStoreName: 'target.myshopify.com',
    })

    expect(error).toBeInstanceOf(OperationError)
    expect(error.operation).toBe('startBulkDataStoreCopy')
    expect(error.code).toBe(ErrorCodes.UNAUTHORIZED_COPY)
    expect(error.params).toEqual({
      sourceStoreName: 'source.myshopify.com',
      targetStoreName: 'target.myshopify.com',
    })
    expect(error.message).toBe(
      "You are not authorized to copy data between these stores\n\nTo export data from \"source.myshopify.com\"\n• You'll need the 'bulk data > export' permission\n\nTo import data to \"target.myshopify.com\"\n• You'll need the 'bulk data > import' permission",
    )
  })

  test('should create unauthorized errors with request IDs', () => {
    const exportError = new OperationError(
      'startBulkDataStoreExport',
      ErrorCodes.UNAUTHORIZED_EXPORT,
      {
        storeName: 'test-store.myshopify.com',
      },
      'export-request-123',
    )

    expect(exportError.requestId).toBe('export-request-123')
    expect(exportError.message).toBe(
      "You are not authorized to export bulk data from store \"test-store.myshopify.com\"\n\nTo export you'll need the 'bulk data > export' permission",
    )

    const importError = new OperationError(
      'startBulkDataStoreImport',
      ErrorCodes.UNAUTHORIZED_IMPORT,
      {
        storeName: 'test-store.myshopify.com',
      },
      'import-request-456',
    )

    expect(importError.requestId).toBe('import-request-456')
    expect(importError.message).toBe(
      "You are not authorized to import bulk data to store \"test-store.myshopify.com\"\n\nTo import you'll need the 'bulk data > import' permission",
    )

    const copyError = new OperationError(
      'startBulkDataStoreCopy',
      ErrorCodes.UNAUTHORIZED_COPY,
      {
        sourceStoreName: 'source.myshopify.com',
        targetStoreName: 'target.myshopify.com',
      },
      'copy-request-789',
    )

    expect(copyError.requestId).toBe('copy-request-789')
    expect(copyError.message).toBe(
      "You are not authorized to copy data between these stores\n\nTo export data from \"source.myshopify.com\"\n• You'll need the 'bulk data > export' permission\n\nTo import data to \"target.myshopify.com\"\n• You'll need the 'bulk data > import' permission",
    )
  })

  test('should create STAGED_UPLOAD_ACCESS_DENIED error', () => {
    const error = new OperationError('upload', ErrorCodes.STAGED_UPLOAD_ACCESS_DENIED)

    expect(error).toBeInstanceOf(OperationError)
    expect(error.operation).toBe('upload')
    expect(error.code).toBe(ErrorCodes.STAGED_UPLOAD_ACCESS_DENIED)
    expect(error.message).toBe(
      "You don't have permission to upload files to this store.\n\nYou'll need the 'bulk data > import' permission to upload files.",
    )
  })
})
