import {Agent, setGlobalDispatcher} from 'undici'

/**
 * Header-size cap for theme dev traffic, in bytes.
 *
 * Storefronts legitimately send large header blocks: a cookie'd request can
 * collect a `Set-Cookie` collection well past 16 KiB, and the browser's
 * cookie jar for the local origin grows the same way on the request side.
 * Neither Node's bundled fetch nor its HTTP server lets the CLI inherit a
 * stable default here — the effective cap has drifted between Node releases
 * (8 KiB, then 16 KiB, with the bundled fetch parser behaving differently
 * again), which made `theme dev` fail with `UND_ERR_HEADERS_OVERFLOW` 502s
 * depending on the Node version under it. Pin the cap explicitly instead:
 * 128 KiB matches the largest mainstream CDN header ceiling and covers the
 * measured failing storefront responses with headroom, while remaining an
 * upper-bound check rather than a preallocated buffer.
 */
export const MAX_HEADER_SIZE = 128 * 1024

/**
 * Creates the fetch dispatcher used for storefront requests in `theme dev`.
 * A dedicated dispatcher (rather than undici's defaults) is what pins the
 * response-header cap described on {@link MAX_HEADER_SIZE}.
 */
export function createStorefrontDispatcher() {
  return new Agent({maxHeaderSize: MAX_HEADER_SIZE})
}

let dispatcherInstalled = false

/**
 * Installs {@link createStorefrontDispatcher} as the global fetch dispatcher
 * for this process. The storefront proxy and renderer use the global `fetch`,
 * which reads the global dispatcher (undici coordinates it across copies via
 * a shared global symbol), so installing it once when a dev server starts
 * covers every storefront request without changing those call sites.
 * Idempotent: later calls are no-ops.
 */
export function installStorefrontFetchDispatcher() {
  if (dispatcherInstalled) return
  dispatcherInstalled = true
  setGlobalDispatcher(createStorefrontDispatcher())
}
