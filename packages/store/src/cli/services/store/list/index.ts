import {
  isPreviewStoreSession,
  listStoredStoreAppSessions,
  sessionKind,
  type StoredStoreAppSession,
} from '../auth/session-store.js'

export type StoreListEntryKind = 'standard' | 'preview'

export interface StoreListEntry {
  store: string
  kind: StoreListEntryKind
  userId: string
  email?: string
  placeholderAccountUuid?: string
  coreUrl?: string
}

interface ListStoredStoresOptions {
  /** Optional filter. When omitted, all sessions are returned. */
  kind?: StoreListEntryKind
}

/**
 * Enumerates every stored store-auth session and projects it into the row shape consumed
 * by the `shopify store list` command's renderer.
 *
 * The session-store enumerator already strips malformed buckets and surfaces only each
 * bucket's current-user session, so the shape returned here is a faithful 1:1 view of
 * what other store commands would resolve when called with the same `--store` flag.
 *
 * Results are sorted alphabetically by store domain so the output is deterministic and
 * easy to diff across runs.
 */
export function listStoredStores(options: ListStoredStoresOptions = {}): StoreListEntry[] {
  const entries = listStoredStoreAppSessions().map(toListEntry)
  const filtered = options.kind ? entries.filter((entry) => entry.kind === options.kind) : entries
  return filtered.sort((a, b) => a.store.localeCompare(b.store))
}

function toListEntry(session: StoredStoreAppSession): StoreListEntry {
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
