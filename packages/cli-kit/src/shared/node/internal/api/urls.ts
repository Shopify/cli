/**
 * Removes the sensitive data from the url and outputs them as a string.
 * @param url - HTTP headers.
 * @returns A sanitized version of the url as a string.
 */
export function sanitizeURL(url: string): string {
  const parsedUrl = new URL(url)
  if (parsedUrl.searchParams.has('subject_token')) {
    parsedUrl.searchParams.set('subject_token', '****')
  }
  if (parsedUrl.searchParams.has('token')) {
    parsedUrl.searchParams.set('token', '****')
  }
  return parsedUrl.toString()
}
