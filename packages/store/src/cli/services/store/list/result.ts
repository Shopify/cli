import {STORE_LIST_LIMIT} from './constants.js'
import {storeListJsonOutputSchema, type StoreListEntry, type StoreListResult} from './types.js'
import {extractSubdomain, formatShortDate} from '../display.js'
import {storeTypeLabel} from '../store-type.js'
import {outputInfo, outputResult, outputWarn} from '@shopify/cli-kit/node/output'
import {renderTable} from '@shopify/cli-kit/node/ui'

export function presentStoreListResult(result: StoreListResult, format: 'text' | 'json'): void {
  if (result.notice) outputWarn(result.notice)
  if (result.truncated) outputWarn(truncationWarning(result))

  if (format === 'json') {
    outputResult(storeListJsonOutputSchema.encode(result))
    return
  }

  renderTextResult(result)
}

function truncationWarning(result: StoreListResult): string {
  const organization = result.organization ? ` in ${result.organization.name}` : ' in this organization'
  return `Showing the ${STORE_LIST_LIMIT} most recent stores${organization}. More stores exist.`
}

function renderTextResult(result: StoreListResult): void {
  if (result.stores.length === 0) {
    outputInfo(emptyStateMessage(result))
    return
  }

  if (result.organization) {
    outputInfo(`Organization: ${result.organization.name} (${result.organization.id})`)
  }

  renderOrganizationTable(result.stores)
  outputInfo('To list stores authenticated directly with `shopify store auth`, run `shopify store auth list`.')
}

function renderOrganizationTable(stores: StoreListEntry[]): void {
  renderTable({
    rows: stores.map((entry) => ({
      subdomain: subdomainFor(entry.store),
      name: entry.name ?? '',
      type: storeTypeLabel(entry.type),
      created: formatShortDate(entry.createdAt),
    })),
    columns: {
      subdomain: {header: 'Subdomain'},
      name: {header: 'Name'},
      type: {header: 'Type'},
      created: {header: 'Created'},
    },
  })
}

function emptyStateMessage(result: StoreListResult): string {
  if (result.notice) {
    return [
      'No stores were returned for the current CLI session.',
      '',
      'Run `shopify store auth list` to list stores authenticated directly with `shopify store auth`.',
    ].join('\n')
  }

  if (result.organization) {
    return `No stores found in ${result.organization.name}.`
  }

  return [
    'No stores found in your Shopify organization.',
    '',
    'Run `shopify store auth list` to list stores authenticated directly with `shopify store auth`.',
  ].join('\n')
}

function subdomainFor(store: string): string {
  return extractSubdomain(store) ?? store
}
