/**
 * Check if the format of a URL is valid or not.
 *
 * @param url - URL to be checked.
 * @returns True if the URL is valid, false otherwise.
 */
export const isValidURL = (url: string): boolean => {
  try {
    return Boolean(new URL(url))
  } catch (error: unknown) {
    if (error instanceof TypeError) return false
    throw error
  }
}
