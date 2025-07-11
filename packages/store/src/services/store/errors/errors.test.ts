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
  })
})
