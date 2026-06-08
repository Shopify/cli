/**
 * Extracts the trailing numeric id from a plain GraphQL global id like
 * `gid://shopify/Product/123`.
 *
 * @param gid - A plain GraphQL global id string.
 * @returns The trailing numeric id, or undefined when the string does not end with `/<digits>`.
 */
export function numericIdFromGid(gid: string): string | undefined {
  const match = gid.match(/\/(\d+)$/)
  return match ? match[1] : undefined
}

/**
 * Decodes a base64-encoded GraphQL global id (for example, the form
 * Business Platform APIs return) and returns the trailing numeric id.
 *
 * @param gid - A base64-encoded GraphQL global id.
 * @returns The trailing numeric id, or undefined when the decoded string does not end with `/<digits>`.
 */
export function numericIdFromEncodedGid(gid: string): string | undefined {
  return numericIdFromGid(Buffer.from(gid, 'base64').toString('utf8'))
}

/**
 * Encodes a plain GraphQL global id (`gid://...`) as base64, which is the
 * form some Business Platform endpoints require.
 *
 * @param gid - A plain GraphQL global id string to encode.
 * @returns The base64-encoded gid.
 */
export function encodeGid(gid: string): string {
  return Buffer.from(gid).toString('base64')
}
