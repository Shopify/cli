/**
 * Check if the format of a URL is valid or not.
 *
 * @param url - URL to be checked.
 * @returns True if the URL is valid, false otherwise.
 * @throws An error if URL's constructor throws an error other than `TypeError`.
 */
export function isValidURL(url: string): boolean {
  try {
    return Boolean(new URL(url))
  } catch (error: unknown) {
    if (error instanceof TypeError) return false
    throw error
  }
}

/**
 * Safely parse a string into a URL.
 *
 * @param url - The string to parse into a URL.
 * @returns A URL object if the parsing is successful, undefined otherwise.
 */
export function safeParseURL(url: string): URL | undefined {
  try {
    return new URL(url)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return undefined
  }
}
