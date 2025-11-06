import type {GraphiQLConfig} from '@/types/config.ts'

/**
 * Security: URL validation to prevent XSS and injection attacks
 *
 * This module validates and sanitizes URLs from window.__GRAPHIQL_CONFIG__
 * to prevent malicious scripts or data from being injected through config.
 */

const SAFE_URL_PROTOCOLS = ['http:', 'https:']
const ALLOWED_LOCALHOST_PATTERNS = [
  /^https?:\/\/localhost(:\d+)?(\/.*)?(\?.*)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?(\/.*)?(\?.*)?$/,
  /^https?:\/\/\[::1\](:\d+)?(\/.*)?(\?.*)?$/,
]
const ALLOWED_SHOPIFY_PATTERN = /^https:\/\/[a-zA-Z0-9-]+\.myshopify\.(com|io)(:\d+)?(\/.*)?(\?.*)?$/

/**
 * Validates that a URL is safe to use (no javascript:, data:, or other dangerous protocols)
 */
function isUrlSafe(url: string): boolean {
  try {
    // eslint-disable-next-line node/no-unsupported-features/node-builtins
    const parsed = new URL(url)

    // Only allow http/https protocols
    if (!SAFE_URL_PROTOCOLS.includes(parsed.protocol)) {
      return false
    }

    // Check for suspicious patterns that could indicate XSS attempts
    const suspiciousPatterns = [/javascript:/i, /data:/i, /vbscript:/i, /<script/i, /onerror=/i, /onload=/i]

    if (suspiciousPatterns.some((pattern) => pattern.test(url))) {
      return false
    }

    return true
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    // Invalid URL format - not rethrowing as this is expected for invalid URLs
    return false
  }
}

/**
 * Validates that a URL matches expected patterns (localhost or Shopify domains)
 */
function isUrlAllowed(url: string): boolean {
  try {
    // Check localhost patterns
    if (ALLOWED_LOCALHOST_PATTERNS.some((pattern) => pattern.test(url))) {
      return true
    }

    // Check Shopify domain pattern
    if (ALLOWED_SHOPIFY_PATTERN.test(url)) {
      return true
    }

    return false
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    // Pattern matching error - not rethrowing as this is expected for malformed URLs
    return false
  }
}

/**
 * Validates and sanitizes a URL, returning the safe URL or a fallback
 */
function validateUrl(url: string | undefined, fallback: string): string {
  if (!url) {
    return fallback
  }

  if (!isUrlSafe(url)) {
    // eslint-disable-next-line no-console
    console.warn(`[Security] Unsafe URL rejected: ${url}. Using fallback: ${fallback}`)
    return fallback
  }

  if (!isUrlAllowed(url)) {
    // eslint-disable-next-line no-console
    console.warn(`[Security] URL not in allowlist: ${url}. Using fallback: ${fallback}`)
    return fallback
  }

  return url
}

/**
 * Sanitizes a string to prevent XSS by removing potentially dangerous content
 */
function sanitizeString(value: string | undefined, fallback: string): string {
  if (!value) {
    return fallback
  }

  // Check for script tags or event handlers
  const dangerousPatterns = [/<script/i, /<\/script/i, /javascript:/i, /onerror=/i, /onload=/i, /onclick=/i]

  if (dangerousPatterns.some((pattern) => pattern.test(value))) {
    // eslint-disable-next-line no-console
    console.warn(`[Security] Dangerous content detected in string. Using fallback.`)
    return fallback
  }

  return value
}

/**
 * Validates the entire GraphiQL config object
 * Returns a sanitized config with dangerous values replaced by safe fallbacks
 */
export function validateConfig(config: Partial<GraphiQLConfig> | undefined, fallback: GraphiQLConfig): GraphiQLConfig {
  if (!config || typeof config !== 'object') {
    // eslint-disable-next-line no-console
    console.warn('[Security] Invalid config object. Using fallback.')
    return fallback
  }

  return {
    // Validate URLs with strict checks
    baseUrl: validateUrl(config.baseUrl, fallback.baseUrl),
    appUrl: validateUrl(config.appUrl, fallback.appUrl),

    // Sanitize string fields
    apiVersion: sanitizeString(config.apiVersion, fallback.apiVersion),
    apiVersions: Array.isArray(config.apiVersions)
      ? config.apiVersions
          .filter((version) => typeof version === 'string')
          .map((version) => sanitizeString(version, ''))
          .filter((version) => version !== '')
      : fallback.apiVersions,
    appName: sanitizeString(config.appName, fallback.appName),
    storeFqdn: sanitizeString(config.storeFqdn, fallback.storeFqdn),

    // Optional fields with validation
    key: config.key ? sanitizeString(config.key, '') : undefined,
    query: config.query ? sanitizeString(config.query, '') : undefined,
    variables: config.variables ? sanitizeString(config.variables, '') : undefined,

    // Complex nested structure validation
    defaultQueries: Array.isArray(config.defaultQueries)
      ? config.defaultQueries.map((queryItem) => ({
          query: sanitizeString(queryItem?.query, ''),
          variables: queryItem?.variables ? sanitizeString(queryItem.variables, '') : undefined,
          preface: queryItem?.preface ? sanitizeString(queryItem.preface, '') : undefined,
        }))
      : fallback.defaultQueries,
  }
}
