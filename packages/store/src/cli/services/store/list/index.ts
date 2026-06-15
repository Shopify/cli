import {listBusinessPlatformStores} from './bp-source.js'
import {STORE_LIST_LIMIT} from './constants.js'
import {type ListStoresResult, type StoreListEntry, type StoreListOrganization} from './types.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import {isTTY} from '@shopify/cli-kit/node/ui'
import {fetchOrganizationsWithAccessInfo, selectOrganizationFromList, type Organization} from '@shopify/organizations'

interface ListStoresOptions {
  organizationId?: number
}

export async function listStores(options: ListStoresOptions = {}): Promise<ListStoresResult> {
  const token = await ensureAuthenticatedBusinessPlatform()
  const organizationsResult = await fetchOrganizationsWithAccessInfo(token)

  if (!organizationsResult.currentUserResolved) {
    return {
      stores: [],
      source: 'organization',
      notice: "Couldn't resolve a Shopify account for the current CLI session.",
    }
  }

  if (organizationsResult.organizations.length === 0) {
    return {stores: [], source: 'organization'}
  }

  if (!options.organizationId && organizationsResult.organizations.length > 1 && !isTTY()) {
    throw new AbortError(
      'An organization ID is required to list stores non-interactively.',
      'Provide `--organization-id`, for example `--organization-id 1234567`. Run `shopify organization list` to find IDs.',
    )
  }

  const selectedOrganization = await selectOrganizationFromList(
    organizationsResult.organizations,
    options.organizationId?.toString(),
  )

  const result = await listBusinessPlatformStores({token, organization: selectedOrganization})
  const {stores, truncated} = limitEntries(result.entries, result.hasMore ?? false)

  return {
    stores,
    source: 'organization',
    organization: storeListOrganization(selectedOrganization),
    ...(truncated ? {truncated: true} : {}),
  }
}

function storeListOrganization(organization: Organization): StoreListOrganization {
  return {id: organization.id, name: organization.businessName}
}

// Caps the listing at STORE_LIST_LIMIT, keeping the already-sorted (newest-first) head. The result
// is truncated when the source reported more stores than it fetched, or when the selected
// organization produced more than the limit.
function limitEntries(entries: StoreListEntry[], hasMore: boolean): {stores: StoreListEntry[]; truncated: boolean} {
  return {stores: entries.slice(0, STORE_LIST_LIMIT), truncated: hasMore || entries.length > STORE_LIST_LIMIT}
}
