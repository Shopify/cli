import {type StoreAuthListEntry, type StoreAuthListResult} from './list.js'
import {outputInfo, outputResult} from '@shopify/cli-kit/node/output'
import {renderTable} from '@shopify/cli-kit/node/ui'
import {formatShortDate} from '@shopify/cli-kit/common/string'
import {extractSubdomain} from '@shopify/cli-kit/common/url'

export function writeStoreAuthListResult(result: StoreAuthListResult, format: 'text' | 'json'): void {
  if (format === 'json') {
    outputResult(JSON.stringify({sessions: result.sessions}, null, 2))
    return
  }

  renderTextResult(result)
}

function renderTextResult(result: StoreAuthListResult): void {
  if (result.sessions.length === 0) {
    outputInfo(emptyStateMessage())
    return
  }

  outputInfo('Stores authenticated directly with `shopify store auth`:')
  renderTable({
    rows: result.sessions.map((session) => ({
      store: extractSubdomain(session.store) ?? session.store,
      account: accountLabel(session),
      scopes: session.scopes.join(', '),
      connected: formatShortDate(session.connectedAt),
    })),
    columns: {
      store: {header: 'Store'},
      account: {header: 'Account'},
      scopes: {header: 'Scopes'},
      connected: {header: 'Connected'},
    },
  })
  outputInfo('To list stores in a Shopify organization, run `shopify store list`.')
}

function emptyStateMessage(): string {
  return [
    'No stores are authenticated directly with `shopify store auth`.',
    '',
    'Run `shopify store auth --store <domain> --scopes <scopes>` to authenticate a store.',
    'Run `shopify store list` to list stores in a Shopify organization.',
  ].join('\n')
}

function accountLabel(session: StoreAuthListEntry): string {
  if (session.associatedUser?.email) return session.associatedUser.email

  const name = [session.associatedUser?.firstName, session.associatedUser?.lastName].filter(Boolean).join(' ')
  if (name) return name

  return session.userId
}
