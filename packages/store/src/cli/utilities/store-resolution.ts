import {ResolveStoreById} from '../api/graphql/business-platform-destinations/generated/resolve-store-by-id.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {businessPlatformRequestDoc} from '@shopify/cli-kit/node/api/business-platform'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {encodeGid} from '@shopify/cli-kit/common/gid'
import {extractHost} from '@shopify/cli-kit/common/url'
import type {
  ResolveStoreByIdQuery,
  ResolveStoreByIdQueryVariables,
} from '../api/graphql/business-platform-destinations/generated/resolve-store-by-id.js'

// Matches a plain GraphQL global id of the shape `gid://shopify/<Type>/<numericId>`.
// The `gid://` prefix is matched case-insensitively for friendliness; the captured
// type segment is compared explicitly below. We do NOT reuse `numericIdFromGid` for
// validation because it only extracts the trailing number and would happily accept a
// non-Shop GID (for example `gid://shopify/Product/1`).
const SHOP_GID_REGEX = /^gid:\/\/shopify\/([^/]+)\/(\d+)$/i

/**
 * Resolves a user-supplied `--store` value to a normalized myshopify.com FQDN.
 *
 * Accepted inputs:
 * - A Shop GID (`gid://shopify/Shop/<id>`) — resolved to the store's domain via the
 *   Business Platform.
 * - A bare numeric store ID (`<id>`) — resolved the same way. A purely numeric value is
 *   always treated as a store ID, never as an all-numeric subdomain; users with an
 *   all-numeric subdomain must pass the full `<sub>.myshopify.com`.
 * - Anything else — treated as a domain and normalized locally with no network calls,
 *   preserving the previous behavior of the flag exactly.
 *
 * @param input - The raw value passed to `--store`.
 * @returns A normalized myshopify.com FQDN.
 */
export async function resolveStore(input: string): Promise<string> {
  const trimmed = input.trim()

  if (/^gid:\/\//i.test(trimmed)) {
    const match = SHOP_GID_REGEX.exec(trimmed)
    if (!match || match[1]?.toLowerCase() !== 'shop') {
      throw new AbortError(
        `${trimmed} isn't a valid store identifier.`,
        'Pass a Shop GID (gid://shopify/Shop/<id>), a numeric store ID, or a myshopify.com domain.',
      )
    }
    return resolveShopIdToFqdn(match[2]!)
  }

  if (/^\d+$/.test(trimmed)) {
    return resolveShopIdToFqdn(trimmed)
  }

  // Existing domain path: pure string normalization, no network.
  return normalizeStoreFqdn(trimmed)
}

/**
 * Resolves a numeric shop id to its myshopify.com FQDN via the Business Platform.
 *
 * The org-agnostic destinations API (`currentUserAccount`) exposes a single direct
 * `destination(id:)` lookup, so resolution is one request — no org enumeration. A shop
 * destination's `publicId` is the shop's numeric id, encoded as a `DestinationPublicID`.
 *
 * @param shopId - The bare numeric shop id.
 * @returns The store's normalized myshopify.com host.
 */
async function resolveShopIdToFqdn(shopId: string): Promise<string> {
  // The token_refresh handler transparently swaps in a fresh token if one expires
  // mid-resolution.
  const unauthorizedHandler = {
    type: 'token_refresh' as const,
    handler: async () => {
      const newToken = await ensureAuthenticatedBusinessPlatform()
      return {token: newToken}
    },
  }

  // BP's DestinationPublicID *input* scalar expects a base64-encoded
  // `gid://organization/ShopifyShop/<id>`, not the bare numeric id. Mirrors the encoding
  // used by app-management-client.ts `encodedGidFromShopId`.
  const id = encodeGid(`gid://organization/ShopifyShop/${shopId}`)

  // Authenticate once and make the single direct lookup. If we can't reach the Business
  // Platform at all (auth failure, network error), present a friendly AbortError rather than
  // a raw stack trace. Existing AbortErrors pass through unchanged so we don't double-wrap.
  let response: ResolveStoreByIdQuery
  try {
    const token = await ensureAuthenticatedBusinessPlatform()
    response = await businessPlatformRequestDoc<ResolveStoreByIdQuery, ResolveStoreByIdQueryVariables>({
      query: ResolveStoreById,
      token,
      variables: {id},
      unauthorizedHandler,
    })
  } catch (error) {
    if (error instanceof AbortError) throw error
    throw new AbortError(
      `Couldn't reach the Business Platform to resolve store ID ${shopId}.`,
      'Pass the myshopify.com domain instead.',
    )
  }

  const dest = response.currentUserAccount?.destination
  if (!dest) {
    throw new AbortError(
      `Couldn't find a store with ID ${shopId} in your organizations.`,
      "Verify the ID, pass the myshopify.com domain instead, or make sure you're signed in to an account with access to the store.",
    )
  }

  // Read the host from `webUrl` FIRST: it is the canonical `*.myshopify.com` URL. Only fall
  // back to `primaryDomain`, which MAY be a merchant custom domain — preferring it would
  // resolve a custom-domain store to e.g. `www.example.com` and break downstream handling.
  // Note: `extractHost` lowercases the host, whereas the domain-input path uses
  // `normalizeStoreFqdn`, which preserves case. This asymmetry is intentional and harmless
  // for canonical BP-resolved myshopify.com domains, which are already lowercase.
  const domain = extractHost(dest.webUrl) ?? (dest.primaryDomain ? extractHost(dest.primaryDomain) : undefined)
  if (!domain) {
    throw new AbortError(
      `Found the store with ID ${shopId} but couldn't determine its domain.`,
      'Pass the myshopify.com domain directly.',
    )
  }
  return domain
}
