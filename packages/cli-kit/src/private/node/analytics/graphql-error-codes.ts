/**
 * Pure helpers for reading routing-relevant codes out of a GraphQL error response.
 *
 * This module is intentionally dependency-free: it is imported by both the grouping logic
 * (`error-grouping.ts`) and the crash-report suppression logic (`../../public/node/error.ts`).
 * `error.ts` cannot import `error-grouping.ts` directly — that would create an
 * `error.ts → headers.ts → error.ts` import cycle — so the shared scanning logic lives here,
 * where it imports nothing from cli-kit.
 */

/** GraphQL `extensions.code` values we treat as rate limiting. */
const RATE_LIMIT_CODES = new Set(['THROTTLED', '429'])

/**
 * GraphQL `extensions.code` values (and nested App Management `app_errors` categories) we treat as
 * a permission / access-denied signal. The top-level admin code is `ACCESS_DENIED`; the App
 * Management nested shape uses the lowercase category `access_denied`.
 */
const PERMISSION_CODES = new Set(['ACCESS_DENIED', 'access_denied'])

/**
 * Collects every routing-relevant code from a GraphQL `errors` value.
 *
 * Scans *all* errors (not just the first), reading both the top-level `extensions.code` and the
 * nested App Management shape `extensions.app_errors.errors[].category`. The API can also return
 * `errors` as a string (e.g. some 401s), which yields no codes.
 *
 * @param errors - The `errors` value from a GraphQL response (array, string, or undefined).
 * @returns Every string code/category found, in document order.
 */
export function graphQLErrorCodes(errors: unknown): string[] {
  if (!Array.isArray(errors)) return []

  return errors.flatMap((entry) => {
    const found: string[] = []
    const error = entry as {extensions?: {code?: unknown; app_errors?: {errors?: unknown}}} | undefined

    const code = error?.extensions?.code
    if (typeof code === 'string') found.push(code)

    const appErrors = error?.extensions?.app_errors?.errors
    if (Array.isArray(appErrors)) {
      for (const appError of appErrors) {
        const category = (appError as {category?: unknown} | undefined)?.category
        if (typeof category === 'string') found.push(category)
      }
    }

    return found
  })
}

/**
 * Whether a single code is a rate-limit signal (`THROTTLED` or `429`).
 *
 * Mirrors the established shape detected by `errorsIncludeStatus429` in `private/node/api.ts`,
 * where `extensions.code === '429'` signals rate limiting even at HTTP 200.
 */
export function isRateLimitCode(code: string | undefined): boolean {
  return code !== undefined && RATE_LIMIT_CODES.has(code)
}

/**
 * Whether a single code/category is a permission / access-denied signal.
 */
export function isPermissionCode(code: string | undefined): boolean {
  return code !== undefined && PERMISSION_CODES.has(code)
}

/**
 * Whether any GraphQL error carries a rate-limit code. Convenience for suppression logic that only
 * needs a boolean over the raw `errors` value.
 *
 * @param errors - The `errors` value from a GraphQL response.
 * @returns True when a rate-limit code is present in any error.
 */
export function hasRateLimitCode(errors: unknown): boolean {
  return graphQLErrorCodes(errors).some(isRateLimitCode)
}
