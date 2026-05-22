import {type StoreListEntry} from './index.js'
import {businessPlatformRequest, businessPlatformOrganizationsRequest} from '@shopify/cli-kit/node/api/business-platform'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import {outputDebug, outputContent, outputToken} from '@shopify/cli-kit/node/output'
import type {UnauthorizedHandler} from '@shopify/cli-kit/node/api/graphql'

/**
 * GraphQL query against the BP **destinations** endpoint that returns the orgs
 * the currently-logged-in user has CLI access to.
 *
 * For placeholder sessions `currentUserAccount` resolves to `null`, which we
 * translate to "no orgs visible" upstream.
 */
const LIST_ORGANIZATIONS_QUERY = `
  query ListOrganizationsWithCliAccess {
    currentUserAccount {
      uuid
      email
      organizationsWithAccessToDestination(destination: APPS_CLI) {
        nodes {
          id
          name
        }
      }
    }
  }
`

interface ListOrganizationsResponse {
  currentUserAccount?: {
    uuid: string
    email: string
    organizationsWithAccessToDestination: {
      nodes: {id: string; name: string}[]
    }
  } | null
}

/**
 * GraphQL query against the per-organization BP endpoint that pages through
 * all shops a member of that org can access, regardless of store type.
 *
 * We don't filter by `STORE_TYPE` here (in contrast to `ListAppDevStores` in
 * `@shopify/app`) because `store list` is meant to surface every shop the user
 * has, not just app-development sandboxes \u2014 production stores, transfer-
 * disabled dev stores, and preview stores should all appear.
 */
const LIST_ALL_SHOPS_QUERY = `
  query ListAllAccessibleShops($cursor: String, $searchTerm: String) {
    organization {
      id
      name
      accessibleShops(first: 50, after: $cursor, search: $searchTerm) {
        edges {
          node {
            id
            externalId
            name
            storeType
            primaryDomain
            shortName
            url
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`

interface AccessibleShopsResponse {
  organization?: {
    id: string
    name: string
    accessibleShops: {
      edges: {
        node: {
          id: string
          externalId?: string | null
          name: string
          storeType?: string | null
          primaryDomain?: string | null
          shortName?: string | null
          url?: string | null
        }
      }[]
      pageInfo: {hasNextPage: boolean; endCursor?: string | null}
    }
  } | null
}

export interface ListBusinessPlatformStoresOptions {
  /**
   * Free-text search forwarded to BP's per-organization shop search. When omitted,
   * every accessible shop in every visible org is returned (paginated server-side
   * at 50/page; this helper auto-pages to completion).
   */
  search?: string
}

export interface ListBusinessPlatformStoresResult {
  entries: StoreListEntry[]
  /** Email of the BP `currentUserAccount`. Absent for placeholder sessions. */
  currentUserEmail?: string
  /**
   * True when BP returned `currentUserAccount: null` for the active session.
   * This is the canonical signal for "you are logged in as a placeholder /
   * service account and BP can't enumerate orgs for you" \u2014 callers should
   * fall back to the local cache or surface a clear message.
   */
  unresolvedCurrentUser: boolean
  /** Org count surfaced to BP for this user (post-filtering). */
  organizationCount: number
}

/**
 * Lists every shop accessible to the currently-authenticated BP user, across all
 * organizations they're a member of.
 *
 * Two-phase fetch:
 *   1. Destinations BP endpoint \u2192 `organizationsWithAccessToDestination(APPS_CLI)`
 *      to discover the user's orgs that have CLI access enabled.
 *   2. Per-org organizations BP endpoint \u2192 `accessibleShops` paged through
 *      cursor-based until `hasNextPage` is false. Results are flat-mapped across
 *      orgs into a single sorted list.
 *
 * Note: this method calls `ensureAuthenticatedBusinessPlatform()` internally,
 * so it will refresh / reissue tokens as needed (matching the behavior of every
 * other CLI command). Failures from BP propagate untouched.
 */
export async function listBusinessPlatformStores(
  options: ListBusinessPlatformStoresOptions = {},
): Promise<ListBusinessPlatformStoresResult> {
  const token = await ensureAuthenticatedBusinessPlatform()

  outputDebug('Fetching organizations from Business Platform destinations API...')
  const orgsResponse = await businessPlatformRequest<ListOrganizationsResponse>(LIST_ORGANIZATIONS_QUERY, token)

  if (!orgsResponse.currentUserAccount) {
    outputDebug(
      outputContent`Business Platform returned ${outputToken.raw(
        'currentUserAccount: null',
      )} \u2014 current session is not a real user account (likely a placeholder). Returning empty list.`,
    )
    return {entries: [], unresolvedCurrentUser: true, organizationCount: 0}
  }

  const orgs = orgsResponse.currentUserAccount.organizationsWithAccessToDestination.nodes
  const email = orgsResponse.currentUserAccount.email

  if (orgs.length === 0) {
    return {entries: [], currentUserEmail: email, unresolvedCurrentUser: false, organizationCount: 0}
  }

  // Fetch shops for each org in parallel. We could serialize to avoid hammering
  // BP, but org counts are typically tiny (one or two) for the CLI persona, so
  // the wall-clock saving from parallelism outweighs the politeness cost.
  const perOrgResults = await Promise.all(
    orgs.map(async (org) => fetchAllShopsForOrganization(token, org)),
  )

  const entries: StoreListEntry[] = perOrgResults.flat()
  entries.sort((a, b) => a.store.localeCompare(b.store))

  return {
    entries,
    currentUserEmail: email,
    unresolvedCurrentUser: false,
    organizationCount: orgs.length,
  }
}

/**
 * Pages through `accessibleShops` for one organization until exhausted, mapping
 * each shop node into the `StoreListEntry` shape.
 *
 * BP returns the organization GID as `gid://organization/Organization/<id>`;
 * the per-organization endpoint URL requires the numeric id only, so we strip
 * the prefix here rather than at the call site to keep the URL-construction
 * concern colocated.
 */
async function fetchAllShopsForOrganization(
  token: string,
  org: {id: string; name: string},
): Promise<StoreListEntry[]> {
  const numericOrgId = numericIdFromGid(org.id)
  if (numericOrgId === undefined) {
    outputDebug(outputContent`Skipping org with unparseable GID: ${outputToken.raw(org.id)}`)
    return []
  }

  const collected: StoreListEntry[] = []
  let cursor: string | null = null

  // `businessPlatformOrganizationsRequest` requires an `unauthorizedHandler`
  // in its options bag for the 401-retry path used by long-lived sessions. For
  // a read-only listing this is overkill; we provide a no-op that simply lets
  // the original 401 propagate, because if the BP token has expired mid-listing
  // there's nothing useful we can do beyond surfacing the failure.
  const noopUnauthorizedHandler: UnauthorizedHandler = {
    type: 'token_refresh',
    handler: async () => ({token: undefined}),
  }

  // Hard cap on pagination loops to avoid spinning indefinitely on a BP that
  // misbehaves (e.g. returns `hasNextPage: true` forever). 200 pages * 50 shops
  // = 10k shops; well above any realistic user's accessible-shop count.
  const MAX_PAGES = 200
  for (let page = 0; page < MAX_PAGES; page++) {
    const response: AccessibleShopsResponse = await businessPlatformOrganizationsRequest<AccessibleShopsResponse>({
      query: LIST_ALL_SHOPS_QUERY,
      token,
      organizationId: numericOrgId,
      variables: {cursor},
      unauthorizedHandler: noopUnauthorizedHandler,
    })

    const shops: NonNullable<AccessibleShopsResponse['organization']>['accessibleShops'] | undefined =
      response.organization?.accessibleShops
    if (!shops) break

    for (const edge of shops.edges) {
      const entry = shopNodeToEntry(edge.node, org)
      if (entry) collected.push(entry)
    }

    if (!shops.pageInfo.hasNextPage) break
    cursor = shops.pageInfo.endCursor ?? null
    if (!cursor) break
  }

  return collected
}

type AccessibleShopNode = NonNullable<
  NonNullable<AccessibleShopsResponse['organization']>['accessibleShops']['edges'][number]['node']
>

function shopNodeToEntry(
  node: AccessibleShopNode,
  org: {id: string; name: string},
): StoreListEntry | undefined {
  // `primaryDomain` is the canonical `*.myshopify.com` host for prod stores and
  // the equivalent for dev/preview stores. Without it the entry isn't usable
  // (no key for `--store` lookups), so drop the node entirely rather than emit
  // a partial row that would confuse the renderer.
  if (!node?.primaryDomain) return undefined

  return {
    store: node.primaryDomain,
    kind: 'standard',
    userId: node.externalId ?? node.id,
    organizationId: numericIdFromGid(org.id),
    organizationName: org.name,
    storeType: node.storeType ?? undefined,
    displayName: node.name,
  }
}

// gid://organization/Organization/1234 \u2192 "1234"; returns undefined if the
// shape is unrecognized so callers can skip rather than crash.
function numericIdFromGid(gid: string): string | undefined {
  if (!gid.startsWith('gid://')) return /^\d+$/.test(gid) ? gid : undefined
  const match = /\/(\d+)$/.exec(gid)
  return match?.[1]
}
