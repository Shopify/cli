export enum ErrorCategory {
  // Reviewed
  ThemeCheck = 'THEME_CHECK',

  // Not reviewed
  Network = 'NETWORK',
  FileSystem = 'FILE_SYSTEM',
  Authentication = 'AUTHENTICATION',
  Validation = 'VALIDATION',
  Permission = 'PERMISSION',
  RateLimit = 'RATE_LIMIT',
  Parsing = 'PARSING',
  Unknown = 'UNKNOWN',
}

const ERROR_CATEGORY_TERMS = {
  [ErrorCategory.ThemeCheck]: ['theme check'],
  [ErrorCategory.Network]: ['fetch', 'request', 'econnrefused', 'enotfound', 'timeout', 'timed out', 'network'],
  [ErrorCategory.FileSystem]: ['enoent', 'eacces', 'file', 'directory', 'path'],
  [ErrorCategory.Authentication]: ['unauthorized', 'forbidden', 'auth', 'token', 'credential'],
  [ErrorCategory.Permission]: ['permission', 'denied', 'access', 'insufficient'],
  [ErrorCategory.RateLimit]: ['rate limit', 'too many requests', 'throttle'],
  [ErrorCategory.Parsing]: ['parse', 'syntax', 'json', 'invalid'],
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
