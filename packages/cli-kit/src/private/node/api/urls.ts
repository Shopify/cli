// Query-string parameter names that may carry sensitive credentials and must
// not be written to logs, verbose debug output, or any other user-visible
// destination. Covers OAuth 2.0 / device-authorization / token-exchange
// parameters.
const SENSITIVE_QUERY_PARAMS = [
  'access_token',
  'refresh_token',
  'id_token',
  'subject_token',
  'actor_token',
  'device_code',
  'client_secret',
  'code',
  'token',
]

/**
 * Removes the sensitive data from the url and outputs them as a string.
 * @param url - HTTP headers.
 * @returns A sanitized version of the url as a string.
 */
export function sanitizeURL(url: string): string {
  const parsedUrl = new URL(url)
  if (parsedUrl.username) {
    parsedUrl.username = '****'
  }
  if (parsedUrl.password) {
    parsedUrl.password = '****'
  }

  const sensitiveParams = new Set(SENSITIVE_QUERY_PARAMS.map((param) => param.toLowerCase()))
  for (const [key] of parsedUrl.searchParams.entries()) {
    if (sensitiveParams.has(key.toLowerCase())) {
      parsedUrl.searchParams.set(key, '****')
    }
  }
  return parsedUrl.toString()
}
