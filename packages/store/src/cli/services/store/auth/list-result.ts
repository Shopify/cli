import {type StoreAuthListResult} from './list.js'
import {extractSubdomain, formatShortDate} from '../display.js'
import {outputInfo, outputResult} from '@shopify/cli-kit/node/output'
import {renderTable} from '@shopify/cli-kit/node/ui'

export function writeStoreAuthListResult(result: StoreAuthListResult, format: 'text' | 'json'): void {
  if (format === 'json') {
    outputResult(JSON.stringify(toJsonResult(result), null, 2))
    return
  }

  renderTextResult(result)
}

function toJsonResult(result: StoreAuthListResult): {
  sessions: ReturnType<typeof toDisplaySession>[]
  message?: string
} {
  return {
    sessions: result.sessions.map(toDisplaySession),
    ...(result.sessions.length === 0 ? {message: emptyStateMessage()} : {}),
  }
}

function renderTextResult(result: StoreAuthListResult): void {
  if (result.sessions.length === 0) {
    outputInfo(emptyStateMessage())
    return
  }

  renderTable({
    rows: result.sessions.map(toDisplaySession),
    columns: {
      subdomain: {header: 'Subdomain'},
      connected: {header: 'Connected'},
    },
  })
}

function toDisplaySession(session: StoreAuthListResult['sessions'][number]): {subdomain: string; connected: string} {
  return {
    subdomain: extractSubdomain(session.store) ?? session.store,
    connected: formatShortDate(session.connectedAt),
  }
}

function emptyStateMessage(): string {
  return [
    'No stores are authenticated directly with `shopify store auth`.',
    '',
    'Run `shopify store auth --store <domain> --scopes <scopes>` to authenticate a store.',
    'Run `shopify store list` to list stores in a Shopify organization.',
  ].join('\n')
}
