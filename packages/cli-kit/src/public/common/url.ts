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

/**
 * Extracts the lowercased hostname from a URL-shaped string. Tolerates
 * bare hosts (without a scheme) and inputs that come back from APIs as
 * either `https://shop.myshopify.com` or `shop.myshopify.com`.
 *
 * @param value - A URL or bare host string, possibly null/undefined.
 * @returns The lowercased hostname, or undefined when the input is empty.
 */
export function extractHost(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  const lowered = value.toLowerCase()
  const parsed = safeParseURL(lowered)
  if (parsed) return parsed.hostname
  return lowered.replace(/^https?:\/\//, '').split('/')[0]
}

/**
 * Extracts the subdomain handle from a `*.myshopify.com` URL or host.
 *
 * @param value - A URL or host string, possibly null/undefined.
 * @returns The myshopify subdomain handle, or undefined when the input isn't a `*.myshopify.com` URL.
 */
export function extractMyshopifyHandle(value: string | null | undefined): string | undefined {
  const host = extractHost(value)
  if (!host) return undefined
  const match = host.match(/^([^.]+)\.myshopify\.com$/)
  return match ? match[1] : undefined
}
