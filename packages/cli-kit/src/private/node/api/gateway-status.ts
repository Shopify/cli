const GATEWAY_ERROR_STATUSES = new Set([502, 503, 504])

/**
 * Checks whether an HTTP status indicates a gateway-level failure.
 *
 * @param status - The HTTP status to check.
 * @returns Whether the status is 502, 503, or 504.
 */
export function isGatewayErrorStatus(status: number | undefined): boolean {
  return status !== undefined && GATEWAY_ERROR_STATUSES.has(status)
}
