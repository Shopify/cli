// 520 to 524 are the error statuses of the Cloudflare edge in front of Shopify. Each answers with an
// HTML page instead of the API's JSON. 500 is not here, because it can come from a real server bug.
const GATEWAY_ERROR_STATUSES = new Set([502, 503, 504, 520, 521, 522, 523, 524])

/**
 * Checks whether an HTTP status indicates a gateway-level failure.
 *
 * @param status - The HTTP status to check.
 * @returns Whether the status is 502, 503, 504, or a Cloudflare edge error from 520 to 524.
 */
export function isGatewayErrorStatus(status: number | undefined): boolean {
  return status !== undefined && GATEWAY_ERROR_STATUSES.has(status)
}
