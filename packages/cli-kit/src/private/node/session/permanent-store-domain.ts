import {serviceEnvironment} from '../context/service.js'
import {extractMyshopifyHandle} from '../../../public/common/url.js'
import {fetch} from '../../../public/node/http.js'
import {outputContent, outputDebug, outputInfo, outputToken} from '../../../public/node/output.js'

/**
 * How long to wait for a store's public `/meta.json` before giving up and using the domain as given.
 */
const PERMANENT_DOMAIN_LOOKUP_TIMEOUT_MS = 5000

const resolvedStoreFqdns = new Map<string, Promise<string>>()

/**
 * Resolves the permanent `.myshopify.com` domain of a store.
 *
 * A store can be reached through several domains (a renamed `.myshopify.com` domain, a custom domain), but some
 * Shopify services only recognise the store's permanent domain. The Theme Access app is one of them: its passwords
 * are tied to the permanent domain, so a request made with any other domain fails with a 401.
 *
 * The permanent domain is read from the store's public `/meta.json` endpoint, which needs no authentication and is
 * served even when the storefront is password protected. When the lookup fails for any reason, the domain is
 * returned unchanged, so callers behave exactly as they would without this lookup.
 *
 * Results are cached for the lifetime of the process.
 *
 * @param storeFqdn - The store domain the user provided, for example `my-store.myshopify.com`.
 * @returns The store's permanent domain, or `storeFqdn` when it cannot be determined.
 */
export async function resolvePermanentStoreFqdn(storeFqdn: string): Promise<string> {
  if (serviceEnvironment() === 'local') return storeFqdn

  const cached = resolvedStoreFqdns.get(storeFqdn)
  if (cached) return cached

  const resolution = fetchPermanentStoreFqdn(storeFqdn)
  resolvedStoreFqdns.set(storeFqdn, resolution)

  const permanentStoreFqdn = await resolution
  if (permanentStoreFqdn !== storeFqdn) {
    resolvedStoreFqdns.set(permanentStoreFqdn, Promise.resolve(permanentStoreFqdn))
    outputInfo(
      outputContent`Using the permanent domain ${outputToken.raw(permanentStoreFqdn)} for ${outputToken.raw(
        storeFqdn,
      )}.`,
    )
  }
  return permanentStoreFqdn
}

/**
 * Clears the in-process cache used by {@link resolvePermanentStoreFqdn}. Intended for tests.
 */
export function clearPermanentStoreFqdnCache(): void {
  resolvedStoreFqdns.clear()
}

async function fetchPermanentStoreFqdn(storeFqdn: string): Promise<string> {
  const url = `https://${storeFqdn}/meta.json`
  try {
    const response = await fetch(
      url,
      {headers: {Accept: 'application/json'}},
      {useNetworkLevelRetry: false, useAbortSignal: true, timeoutMs: PERMANENT_DOMAIN_LOOKUP_TIMEOUT_MS},
    )
    if (!response.ok) {
      outputDebug(`Could not look up the permanent domain of ${storeFqdn}: ${url} returned HTTP ${response.status}`)
      return storeFqdn
    }

    const body = (await response.json()) as {myshopify_domain?: unknown} | null
    const permanentStoreFqdn = typeof body?.myshopify_domain === 'string' ? body.myshopify_domain.toLowerCase() : ''
    // Accept only a bare `<handle>.myshopify.com`: `extractMyshopifyHandle` also accepts a URL with a path, so
    // compare the round trip to reject anything but the domain itself.
    const handle = extractMyshopifyHandle(permanentStoreFqdn)
    if (!handle || `${handle}.myshopify.com` !== permanentStoreFqdn) {
      outputDebug(`Could not look up the permanent domain of ${storeFqdn}: ${url} has no valid myshopify_domain`)
      return storeFqdn
    }

    return permanentStoreFqdn
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    outputDebug(`Could not look up the permanent domain of ${storeFqdn}: ${message}`)
    return storeFqdn
  }
}
