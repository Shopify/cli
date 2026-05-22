import {listBusinessPlatformStores, type ListBusinessPlatformStoresResult} from './bp-source.js'
import {
  isPreviewStoreSession,
  listStoredStoreAppSessions,
  sessionKind,
  type StoredStoreAppSession,
} from '../auth/session-store.js'

export type StoreListEntryKind = 'standard' | 'preview'
export type StoreListSource = 'bp' | 'local'

export interface StoreListEntry {
  store: string
  kind: StoreListEntryKind
  userId: string
  email?: string
  /** Preview-store specific: the Identity-side placeholder UUID. */
  placeholderAccountUuid?: string
  /** Preview-store specific: Core URL that minted the session. */
  coreUrl?: string
  /**
   * BP-derived entries only: numeric organization id the shop belongs to. Absent
   * for entries sourced from the local store-auth cache, which has no notion of
   * orgs.
   */
  organizationId?: string
  /** BP-derived entries only: org display name. */
  organizationName?: string
  /** BP-derived entries only: free-form `storeType` (e.g. `DEVELOPMENT`, `PRODUCTION`). */
  storeType?: string
  /** BP-derived entries only: shop display name (distinct from the `*.myshopify.com` host). */
  displayName?: string
}

export interface ListStoredStoresOptions {
  /**
   * Selects the data source for the listing:
   *
   * - `bp` (default): fetch the orgs + shops the currently-authenticated BP user
   *   has access to. Requires a logged-in account that BP can resolve as a
   *   `UserAccount`. Returns `[]` for placeholder sessions.
   * - `local`: enumerate the local store-auth cache (`shopify-cli-store-nodejs`),
   *   yielding every store the CLI has previously authed against on this
   *   machine. Useful for offline use, for surfacing freshly-imported preview
   *   stores that haven't propagated to BP yet, and as a fallback when the BP
   *   path returns no results.
   */
  source?: StoreListSource
  /**
   * Free-text search forwarded to BP's per-organization shop search. Only honoured
   * when `source: 'bp'`. The local source ignores this flag for now \u2014 callers
   * can post-filter the returned entries themselves.
   */
  search?: string
  /** Optional filter on the local-source `kind` discriminator. */
  kind?: StoreListEntryKind
}

export interface ListStoredStoresResult {
  entries: StoreListEntry[]
  /** Which source actually produced the rows. */
  source: StoreListSource
  /**
   * Non-fatal diagnostic emitted when the BP path returned zero useful rows.
   * Populated only when `source: 'bp'` and either:
   *   - BP returned `currentUserAccount: null` (placeholder session), or
   *   - BP returned 0 orgs / 0 shops.
   *
   * Renderer surfaces this verbatim to the user.
   */
  notice?: string
  /** BP source: email of the resolved user; absent for local source. */
  currentUserEmail?: string
}

/**
 * High-level entry point for `shopify store list`.
 *
 * Routes to either the BP-backed source or the local-cache source, normalises
 * the result into `StoreListEntry[]`, and surfaces a non-fatal `notice` string
 * the renderer can show when the BP path produced nothing useful (placeholder
 * session, no orgs, empty orgs).
 *
 * The local-cache source is also auto-selected for back-compat in two cases the
 * caller didn't have to spell out:
 *   - when the user explicitly passes `--source local`.
 *
 * The BP source is *not* auto-fallen-back-to from local on errors \u2014 we want
 * BP failures to surface clearly rather than be silently masked. Callers who
 * want belt-and-suspenders behaviour can call this twice with different sources
 * and merge the results.
 */
export async function listStoredStores(options: ListStoredStoresOptions = {}): Promise<ListStoredStoresResult> {
  const source: StoreListSource = options.source ?? 'bp'

  if (source === 'local') {
    return {entries: enumerateLocalEntries(options.kind), source: 'local'}
  }

  const bpResult = await listBusinessPlatformStores({search: options.search})
  return {
    entries: bpResult.entries,
    source: 'bp',
    ...(bpResult.currentUserEmail ? {currentUserEmail: bpResult.currentUserEmail} : {}),
    ...(noticeFromBpResult(bpResult) ? {notice: noticeFromBpResult(bpResult)!} : {}),
  }
}

function enumerateLocalEntries(kindFilter?: StoreListEntryKind): StoreListEntry[] {
  const entries = listStoredStoreAppSessions().map(toLocalEntry)
  const filtered = kindFilter ? entries.filter((entry) => entry.kind === kindFilter) : entries
  return filtered.sort((a, b) => a.store.localeCompare(b.store))
}

function toLocalEntry(session: StoredStoreAppSession): StoreListEntry {
  const kind = sessionKind(session)
  const base: StoreListEntry = {
    store: session.store,
    kind,
    userId: session.userId,
    ...(session.associatedUser?.email ? {email: session.associatedUser.email} : {}),
  }

  if (isPreviewStoreSession(session)) {
    base.placeholderAccountUuid = session.preview.placeholderAccountUuid
    base.coreUrl = session.preview.coreUrl
  }

  return base
}

function noticeFromBpResult(result: ListBusinessPlatformStoresResult): string | undefined {
  if (result.unresolvedCurrentUser) {
    return (
      'Business Platform could not resolve the current session as a user account ' +
      '(this is expected for placeholder / preview-store sessions). ' +
      'Re-run with `--source local` to list stores from the local cache instead.'
    )
  }
  if (result.organizationCount === 0) {
    return 'No organizations with CLI access were found for the current user.'
  }
  if (result.entries.length === 0) {
    return `No shops accessible to the current user across ${result.organizationCount} organization(s).`
  }
  return undefined
}
