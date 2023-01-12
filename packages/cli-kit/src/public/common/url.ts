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
