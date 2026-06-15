import {STORE_LIST_LIMIT} from './constants.js'
import {type ListStoresResult, type StoreListEntry} from './types.js'
import {extractSubdomain, formatShortDate} from '../display.js'
import {storeTypeLabel} from '../store-type.js'
import {outputInfo, outputResult, outputWarn} from '@shopify/cli-kit/node/output'
import {renderTable} from '@shopify/cli-kit/node/ui'

export function writeStoreListResult(result: ListStoresResult, format: 'text' | 'json'): void {
  // Human diagnostics always go to stderr so they never corrupt the JSON document on stdout, and so
  // the truncation signal is visible in both formats.
  if (result.notice) outputWarn(result.notice)
  if (result.truncated) outputWarn(truncationWarning(result))

  if (format === 'json') {
    outputResult(
      JSON.stringify(
        {
          stores: result.stores,
          ...(result.organization ? {organization: result.organization} : {}),
          ...(result.notice ? {notice: result.notice} : {}),
          ...(result.truncated ? {truncated: true} : {}),
        },
        null,
        2,
      ),
    )
    return
  }

  renderTextResult(result)
}

function truncationWarning(result: ListStoresResult): string {
  const organization = result.organization ? ` in ${result.organization.name}` : ' in this organization'
  return `Showing the ${STORE_LIST_LIMIT} most recent stores${organization}. More stores exist.`
}

function renderTextResult(result: ListStoresResult): void {
  if (result.stores.length === 0) {
    outputInfo(emptyStateMessage(result))
    return
  }

  if (result.organization) {
    outputInfo(`Organization: ${result.organization.name} (${result.organization.id})`)
  }

  renderOrganizationTable(result.stores)
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

function emptyStateMessage(result: ListStoresResult): string {
  if (result.notice) {
    return 'No stores were returned for the current CLI session.'
  }

  if (result.organization) {
    return `No stores found in ${result.organization.name}.`
  }

  return 'No stores found in your Shopify organization.'
}

function subdomainFor(store: string): string {
  return extractSubdomain(store) ?? store
}
