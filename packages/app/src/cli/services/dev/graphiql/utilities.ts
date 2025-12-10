/**
 * Headers that should NOT be forwarded from the GraphiQL client to the Admin API.
 * These include:
 * - Hop-by-hop headers (RFC 7230) that are connection-specific
 * - Browser-specific headers that are not relevant to API requests
 * - Headers the proxy sets itself (auth, content-type, etc.)
 */
const BLOCKED_HEADERS = new Set([
  // Hop-by-hop headers (RFC 7230 Section 6.1)
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',

  // Headers the proxy controls
  'host',
  'content-length',
  'content-type',
  'accept',
  'user-agent',
  'authorization',
  'cookie',
  'x-shopify-access-token',
])

/**
 * Filters request headers to extract only custom headers that are safe to forward.
 * Blocked headers and non-string values are excluded.
 */
export function filterCustomHeaders(headers: {[key: string]: string | string[] | undefined}): {[key: string]: string} {
  const customHeaders: {[key: string]: string} = {}
  for (const [key, value] of Object.entries(headers)) {
    if (!BLOCKED_HEADERS.has(key.toLowerCase()) && typeof value === 'string') {
      customHeaders[key] = value
    }
  }
  return customHeaders
}
