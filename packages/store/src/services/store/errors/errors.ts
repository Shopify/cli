import {AbortError} from '@shopify/cli-kit/node/error'

export const ErrorCodes = {
  // Validation errors
  SHOP_NOT_FOUND: 'SHOP_NOT_FOUND',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  INVALID_FILE_FORMAT: 'INVALID_FILE_FORMAT',
  SAME_SHOP: 'SAME_SHOP',
  DIFFERENT_ORG: 'DIFFERENT_ORG',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  EMPTY_FILE: 'EMPTY_FILE',
  NOT_A_FILE: 'NOT_A_FILE',
  INVALID_KEY_FORMAT: 'INVALID_KEY_FORMAT',
  KEY_DOES_NOT_EXIST: 'KEY_DOES_NOT_EXIST',
  KEY_NOT_SUPPORTED: 'KEY_NOT_SUPPORTED',

  // Operation errors
  COPY_FAILED: 'COPY_FAILED',
  EXPORT_FAILED: 'EXPORT_FAILED',
  IMPORT_FAILED: 'IMPORT_FAILED',
  BULK_OPERATION_FAILED: 'BULK_OPERATION_FAILED',
  FILE_UPLOAD_FAILED: 'FILE_UPLOAD_FAILED',
  FILE_DOWNLOAD_FAILED: 'FILE_DOWNLOAD_FAILED',
  STAGED_UPLOAD_FAILED: 'STAGED_UPLOAD_FAILED',
  GRAPHQL_API_ERROR: 'GRAPHQL_API_ERROR',

  // Unauthorized errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  UNAUTHORIZED_EXPORT: 'UNAUTHORIZED_EXPORT',
  UNAUTHORIZED_IMPORT: 'UNAUTHORIZED_IMPORT',
  UNAUTHORIZED_COPY: 'UNAUTHORIZED_COPY',
  MISSING_EA_ACCESS: 'MISSING_EA_ACCESS',
  STAGED_UPLOAD_ACCESS_DENIED: 'STAGED_UPLOAD_ACCESS_DENIED',
} as const

interface ErrorParams {
  [key: string]: string | number | boolean | undefined
}

export class OperationError extends AbortError {
  operation: string
  code: string
  params?: ErrorParams
  requestId?: string

  constructor(operation: string, code: string, params?: ErrorParams, requestId?: string) {
    // Generate a message based on the code and params
    const message = generateErrorMessage(code, params, requestId)
    super(message)
    this.operation = operation
    this.code = code
    this.params = params
    this.requestId = requestId
  }
}

export class ValidationError extends AbortError {
  code: string
  params?: ErrorParams

  constructor(code: string, params?: ErrorParams) {
    // Generate a message based on the code and params
    const message = generateErrorMessage(code, params)
    super(message)
    this.code = code
    this.params = params
  }
}

// Helper function to generate error messages based on code and params
function generateErrorMessage(code: string, params?: ErrorParams, requestId?: string): string {
  switch (code) {
    // Validation errors
    case ErrorCodes.SHOP_NOT_FOUND:
      return `Shop "${params?.shop}" not found in any of the Early Access enabled organizations you have access to.`
    case ErrorCodes.FILE_NOT_FOUND:
      return `File "${params?.filePath}" not found.`
    case ErrorCodes.INVALID_FILE_FORMAT:
      return params?.filePath
        ? `File "${params.filePath}" does not appear to be a valid SQLite database.`
        : 'Invalid file format'
    case ErrorCodes.SAME_SHOP:
      return 'Source and target shops must not be the same.'
    case ErrorCodes.DIFFERENT_ORG:
      return 'Source and target shops must be in the same organization.'
    case ErrorCodes.FILE_TOO_LARGE:
      return `File "${params?.filePath}" (${params?.fileSize}) exceeds maximum size of ${params?.maxSize}.`
    case ErrorCodes.EMPTY_FILE:
      return `File "${params?.filePath}" is empty.`
    case ErrorCodes.NOT_A_FILE:
      return `Path "${params?.filePath}" is not a file.`
    case ErrorCodes.INVALID_KEY_FORMAT:
      return `Key format "${params?.key}" is invalid.\nBuilt-in fields can be specified as <object_type>:<key>\n\nID metafields can be used as key by specifying\n<object_type>:metafield:<metafield_namespace>:<metafield_key>.`
    case ErrorCodes.KEY_DOES_NOT_EXIST:
      return `Key "${params?.field}" does not exist or is unsupported.\nBuilt-in fields can be specified as <object_type>:<key>\n\nID metafields can be used as key by specifying\n<object_type>:metafield:<metafield_namespace>:<metafield_key>.`
    case ErrorCodes.KEY_NOT_SUPPORTED:
      return `Object type "${params?.resource}" does not exist or is unsupported.`

    // Operation errors
    case ErrorCodes.COPY_FAILED:
      return 'Copy failed'
    case ErrorCodes.EXPORT_FAILED:
      return 'Export failed'
    case ErrorCodes.IMPORT_FAILED:
      return 'Import failed'
    case ErrorCodes.BULK_OPERATION_FAILED:
      return params?.errors
        ? `Failed to start ${params.operationType} operation: ${params.errors}`
        : 'Bulk operation failed'
    case ErrorCodes.FILE_UPLOAD_FAILED:
      return params?.details ? `File upload failed: ${params.details}` : 'File upload failed'
    case ErrorCodes.FILE_DOWNLOAD_FAILED:
      return 'No response body received'
    case ErrorCodes.STAGED_UPLOAD_FAILED:
      return typeof params?.reason === 'string' ? params.reason : 'Failed to create staged upload'
    case ErrorCodes.GRAPHQL_API_ERROR: {
      const finalRequestId = requestId ?? 'unknown'
      return `Copy could not complete due to an API request failure\n\nRequest Id: ${finalRequestId}`
    }

    // Unauthorized errors
    case ErrorCodes.UNAUTHORIZED:
      return 'You are not authorized to perform this operation'
    case ErrorCodes.UNAUTHORIZED_EXPORT:
      return `You are not authorized to export bulk data from store "${params?.storeName}"\n\nTo export you'll need the 'bulk data > export' permission`
    case ErrorCodes.UNAUTHORIZED_IMPORT:
      return `You are not authorized to import bulk data to store "${params?.storeName}"\n\nTo import you'll need the 'bulk data > import' permission`
    case ErrorCodes.UNAUTHORIZED_COPY:
      return (
        `You are not authorized to copy data between these stores\n\nTo export data from "${params?.sourceStoreName}"\n` +
        `• You'll need the 'bulk data > export' permission\n\nTo import data to "${params?.targetStoreName}"\n` +
        `• You'll need the 'bulk data > import' permission`
      )
    case ErrorCodes.MISSING_EA_ACCESS:
      return `This command is in Early Access and is not yet available for the requested store(s).`
    case ErrorCodes.STAGED_UPLOAD_ACCESS_DENIED:
      return `You don't have permission to upload files to this store.\n\nYou'll need the 'bulk data > import' permission to upload files.`

    default:
      return 'An error occurred'
  }
}
