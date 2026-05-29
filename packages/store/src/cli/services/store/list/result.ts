import {type StoreListEntry} from './index.js'
import {outputInfo, outputResult} from '@shopify/cli-kit/node/output'
import {renderTable} from '@shopify/cli-kit/node/ui'

type StoreListOutputFormat = 'text' | 'json'

const EMPTY_USER_PLACEHOLDER = '—'

export function writeStoreListResult(entries: StoreListEntry[], format: StoreListOutputFormat): void {
  if (format === 'json') {
    outputResult(serializeAsJson(entries))
    return
  }
  renderTextResult(entries)
}

function serializeAsJson(entries: StoreListEntry[]): string {
  return JSON.stringify(entries, null, 2)
}

function renderTextResult(entries: StoreListEntry[]): void {
  if (entries.length === 0) {
    outputInfo(
      [
        'No stores authenticated.',
        '',
        'Run `shopify store auth --store <domain>` to authenticate against an existing store,',
        'or `shopify store create preview` to mint a preview store.',
      ].join('\n'),
    )
    return
  }

  renderTable({
    rows: entries.map((entry) => ({
      store: entry.store,
      kind: entry.kind,
      // Preview sessions are backed by a placeholder identity that has no human-meaningful
      // email; rendering the synthetic value would be misleading, so the column is dashed out.
      user: entry.kind === 'preview' ? EMPTY_USER_PLACEHOLDER : entry.email ?? entry.userId,
    })),
    columns: {
      store: {header: 'Store'},
      kind: {header: 'Kind'},
      user: {header: 'User'},
    },
  })

  outputInfo(`\n${summaryLine(entries)}`)
}

function summaryLine(entries: StoreListEntry[]): string {
  const standardCount = entries.filter((entry) => entry.kind === 'standard').length
  const previewCount = entries.filter((entry) => entry.kind === 'preview').length
  const noun = entries.length === 1 ? 'store' : 'stores'
  return `${entries.length} ${noun} (${standardCount} standard, ${previewCount} preview)`
}
