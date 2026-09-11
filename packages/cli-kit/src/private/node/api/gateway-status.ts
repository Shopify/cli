/**
 * Pure helpers for classifying HTTP statuses that come from the gateway in front of an API rather
 * than from the API itself.
 *
 * This module is intentionally dependency-free so that both the request layer (`../api.ts`) and the
 * crash-report suppression logic in `../../public/node/error.ts` can share it. `error.ts` cannot
 * import `../api.ts` directly — that would pull `graphql-request` into the module graph of every
 * command, and `api.ts → headers.ts → error.ts` is already a cycle — so the shared status logic
 * lives here, where it imports nothing from cli-kit.
 */

/**
 * Statuses commonly emitted by a proxy or load balancer that could not produce a usable response
 * from an upstream service: 502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout.
 *
 * 500 is deliberately excluded: it means the API itself answered and failed, so it keeps its
 * existing non-retryable, reportable behaviour.
 */
const GATEWAY_ERROR_STATUSES = new Set([502, 503, 504])

/**
 * Whether an HTTP status indicates a gateway-level failure in front of the API.
 *
 * @param status - The HTTP status of the response, if known.
 * @returns True when the status is 502, 503 or 504.
 */
export function isGatewayErrorStatus(status: number | undefined): boolean {
  return status !== undefined && GATEWAY_ERROR_STATUSES.has(status)
}
