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
  'password',
  'code_verifier',
  'client_assertion',
  'assertion',
  'auth_token',
]

/**
 * Removes the sensitive data from the url and outputs them as a string.
 * @param url - The URL to sanitize.
 * @returns A sanitized version of the url as a string.
 */
export function sanitizeURL(url: string): string {
  const parsedUrl = new URL(url)
  for (const param of SENSITIVE_QUERY_PARAMS) {
    if (parsedUrl.searchParams.has(param)) {
      parsedUrl.searchParams.set(param, '****')
    }
  }
  if (parsedUrl.password) {
    parsedUrl.password = '****'
  }
  return parsedUrl.toString()
}
