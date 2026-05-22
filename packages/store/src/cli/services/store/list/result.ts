import {type ListStoredStoresResult, type StoreListEntry} from './index.js'
import {outputInfo, outputResult} from '@shopify/cli-kit/node/output'
import {renderTable} from '@shopify/cli-kit/node/ui'

type StoreListOutputFormat = 'text' | 'json'

const EMPTY_USER_PLACEHOLDER = '\u2014'

export function writeStoreListResult(result: ListStoredStoresResult, format: StoreListOutputFormat): void {
  if (format === 'json') {
    outputResult(serializeAsJson(result))
    return
  }
  renderTextResult(result)
}

/**
 * JSON output mirrors the in-memory shape so agents can deserialize directly.
 * Top-level keys (`source`, `notice`, `currentUserEmail`) are siblings of the
 * `entries` array rather than wrapping it, because that lets callers `jq .entries`
 * for the rows without having to also peel off a wrapper.
 */
function serializeAsJson(result: ListStoredStoresResult): string {
  return JSON.stringify(result, null, 2)
}

function renderTextResult(result: ListStoredStoresResult): void {
  const {entries, source, notice, currentUserEmail} = result

  if (entries.length === 0) {
    const lines: string[] = []
    if (notice) lines.push(notice, '')
    if (source === 'bp') {
      lines.push(
        'No stores accessible to the current Business Platform user.',
        '',
        'Try `shopify store list --source local` to see locally-cached stores',
        '(including freshly-created preview stores).',
      )
    } else {
      lines.push(
        'No stores authenticated locally.',
        '',
        'Run `shopify store auth --store <domain>` to authenticate against an existing store,',
        'or `shopify store create preview` to mint a preview store.',
      )
    }
    outputInfo(lines.join('\n'))
    return
  }

  if (notice) outputInfo(`${notice}\n`)

  if (source === 'bp') {
    renderBpTable(entries)
  } else {
    renderLocalTable(entries)
  }

  outputInfo(`\n${summaryLine(entries, source, currentUserEmail)}`)
}

/**
 * BP-sourced rendering. We include the store type and organization name because
 * those are the two fields that disambiguate similarly-named stores within a
 * single user's view, and they're free (already in the BP response).
 */
function renderBpTable(entries: StoreListEntry[]): void {
  renderTable({
    rows: entries.map((entry) => ({
      store: entry.store,
      name: entry.displayName ?? '',
      type: entry.storeType ?? '',
      organization: entry.organizationName ?? '',
    })),
    columns: {
      store: {header: 'Store'},
      name: {header: 'Name'},
      type: {header: 'Type'},
      organization: {header: 'Organization'},
    },
  })
}

/**
 * Local-cache rendering keeps the original three-column shape so callers parsing
 * the text output don't break. Preview sessions render their User column as a
 * dash because the backing placeholder identity has no human-meaningful email.
 */
function renderLocalTable(entries: StoreListEntry[]): void {
  renderTable({
    rows: entries.map((entry) => ({
      store: entry.store,
      kind: entry.kind,
      user: entry.kind === 'preview' ? EMPTY_USER_PLACEHOLDER : entry.email ?? entry.userId,
    })),
    columns: {
      store: {header: 'Store'},
      kind: {header: 'Kind'},
      user: {header: 'User'},
    },
  })
}

function summaryLine(entries: StoreListEntry[], source: 'bp' | 'local', currentUserEmail?: string): string {
  const noun = entries.length === 1 ? 'store' : 'stores'
  if (source === 'bp') {
    const asUser = currentUserEmail ? ` (logged in as ${currentUserEmail})` : ''
    return `${entries.length} ${noun} from Business Platform${asUser}`
  }
  const standardCount = entries.filter((entry) => entry.kind === 'standard').length
  const previewCount = entries.filter((entry) => entry.kind === 'preview').length
  return `${entries.length} ${noun} (${standardCount} standard, ${previewCount} preview) from local cache`
}
