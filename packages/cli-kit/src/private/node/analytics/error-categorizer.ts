export enum ErrorCategory {
  Liquid = 'LIQUID',
  ThemeCheck = 'THEME_CHECK',
  Network = 'NETWORK',
  FileSystem = 'FILE_SYSTEM',
  Authentication = 'AUTHENTICATION',
  Validation = 'VALIDATION',
  Permission = 'PERMISSION',
  RateLimit = 'RATE_LIMIT',
  Json = 'JSON',
  Unknown = 'UNKNOWN',
}

const ERROR_CATEGORY_TERMS = {
  [ErrorCategory.Liquid]: ['liquid'],
  [ErrorCategory.Json]: ['json', 'parse response'],
  [ErrorCategory.ThemeCheck]: ['theme check'],
  [ErrorCategory.Authentication]: ['unauthorized', 'forbidden', 'auth', 'token', 'credential'],
  [ErrorCategory.Network]: [
    'eai_again',
    'econn',
    'enetunreach',
    'enotfound',
    'epipe',
    'etimedout',
    'fetch',
    'network',
    'request',
    'socket',
    'the operation was aborted',
    'timed out',
    'timeout',
  ],
  [ErrorCategory.FileSystem]: ['enoent', 'eacces', 'file', 'directory', 'path'],
  [ErrorCategory.Permission]: ['permission', 'denied', 'access', 'insufficient'],
  [ErrorCategory.RateLimit]: ['rate limit', 'too many requests', 'throttle'],
  [ErrorCategory.Validation]: ['validation', 'invalid', 'required'],
}

export function categorizeError(error: unknown): ErrorCategory {
  if (!(error instanceof Error)) return ErrorCategory.Unknown

  const message = error.message.toLowerCase()

  for (const [category, terms] of Object.entries(ERROR_CATEGORY_TERMS)) {
    const hasTerm = terms.some((term) => message.includes(term))

    if (hasTerm) {
      return category as ErrorCategory
    }
  }

  return ErrorCategory.Unknown
}

/**
 * Formats an error message for analytics tracking, preserving important information
 * based on the error category while keeping it concise and normalized.
 */
export function formatErrorMessage(error: unknown, category: ErrorCategory): string {
  const message = error instanceof Error ? error.message : String(error)

  const formatter = ERROR_FORMATTERS[category] || formatGenericError
  return formatter(message)
}

const ERROR_FORMATTERS: {[key in ErrorCategory]: (message: string) => string} = {
  [ErrorCategory.Network]: formatNetworkError,
  [ErrorCategory.Authentication]: formatGenericError,
  [ErrorCategory.FileSystem]: formatGenericError,
  [ErrorCategory.RateLimit]: formatGenericError,
  [ErrorCategory.Json]: formatGenericError,
  [ErrorCategory.Validation]: formatGenericError,
  [ErrorCategory.Permission]: formatGenericError,
  [ErrorCategory.Liquid]: formatGenericError,
  [ErrorCategory.ThemeCheck]: formatGenericError,
  [ErrorCategory.Unknown]: formatGenericError,
}

function formatNetworkError(message: string): string {
  const httpStatusMatch = message.match(/\b([1-5]\d{2})\b/)
  const connectionErrorMatch = message.match(/\b(E[A-Z]+)\b/)
  const graphqlCodeMatch = message.match(/(?:code|error)[:\s]*(\d{3})/i)

  let normalized = message.toLowerCase().substring(0, 50)

  if (httpStatusMatch?.[1]) {
    const statusCode = httpStatusMatch[1]
    normalized = `http-${statusCode}-${normalized.replace(/\b\d{3}\b/g, '').trim()}`
  } else if (graphqlCodeMatch?.[1]) {
    const statusCode = graphqlCodeMatch[1]
    normalized = `http-${statusCode}-${normalized.replace(/(?:code|error)[:\s]*\d{3}/gi, '').trim()}`
  } else if (connectionErrorMatch?.[1]) {
    const errorCode = connectionErrorMatch[1].toLowerCase()
    normalized = `http-000-${errorCode}-${normalized.replace(/\b[eE][A-Z]+\b/g, '').trim()}`
  } else {
    normalized = `http-000-${normalized}`
  }

  return normalized
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50)
}

function formatGenericError(message: string): string {
  return message
    .toLowerCase()
    .substring(0, 50)
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}
