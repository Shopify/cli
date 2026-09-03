import {STORE_LIST_LIMIT} from './constants.js'
import {type ListStoresResult, type StoreListEntry, type StoreListOrganization} from './types.js'
import {extractSubdomain, formatShortDate} from '../display.js'
import {storeTypeLabel, type StoreTypeFilter} from '../store-type.js'
import {outputResult, outputWarn} from '@shopify/cli-kit/node/output'
import {renderInfo, renderTable, type AlertCustomSection, type TokenItem} from '@shopify/cli-kit/node/ui'

const STORE_AUTH_HINT: TokenItem = [
  'To list stores authenticated directly with',
  {command: 'shopify store auth'},
  {char: ','},
  'run',
  {command: 'shopify store auth list'},
  {char: '.'},
]

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
          ...(result.storeType ? {storeType: result.storeType} : {}),
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
  return `Showing the ${STORE_LIST_LIMIT} most recent ${storeNounPhrase(result.storeType)}${organization}. More stores exist.`
}

// Names what was listed, qualified by the active `--type` filter (`client_transfer` -> `client
// transfer stores`).
function storeNounPhrase(storeType: StoreTypeFilter | undefined): string {
  return storeType ? `${storeType.replaceAll('_', ' ')} stores` : 'stores'
}

function renderTextResult(result: ListStoresResult): void {
  renderInfo({
    headline: textResultHeadline(result),
    customSections: [...organizationSections(result.organization), {body: STORE_AUTH_HINT}],
  })

  if (result.stores.length > 0) {
    renderOrganizationTable(result.stores)
  }
}

function textResultHeadline(result: ListStoresResult): string {
  const stores = storeNounPhrase(result.storeType)
  if (result.stores.length > 0) return `Listing ${stores}.`
  // The notice explains on stderr why the session couldn't be resolved; this states the outcome.
  if (result.notice) return `No ${stores} were returned for the current CLI session.`
  return `No ${stores} found.`
}

function organizationSections(organization: StoreListOrganization | undefined): AlertCustomSection[] {
  if (!organization) return []

  return [
    {
      body: {
        tabularData: [['Organization', `${organization.name} (${organization.id})`]],
        firstColumnSubdued: true,
      },
    },
  ]
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

function subdomainFor(store: string): string {
  return extractSubdomain(store) ?? store
}
