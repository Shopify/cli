/**
 * Headers that should NOT be forwarded from the GraphiQL client to the Admin API.
 * These include:
 * - Hop-by-hop headers (RFC 7230) that are connection-specific.
 * - Browser-specific headers that are not relevant to API requests.
 * - Headers the proxy sets itself (auth, content-type, etc.).
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
 *
 * @param headers - The raw incoming request headers.
 * @returns The subset of headers that are safe to forward to the Admin API.
 */
export function filterCustomHeaders(headers: {[key: string]: string | string[] | undefined}): {[key: string]: string} {
  const validEntries = Object.entries(headers).filter(
    (entry): entry is [string, string] => !BLOCKED_HEADERS.has(entry[0].toLowerCase()) && typeof entry[1] === 'string',
  )
  return Object.fromEntries(validEntries)
}
