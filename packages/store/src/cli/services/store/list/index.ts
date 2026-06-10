import {listBusinessPlatformStores} from './bp-source.js'
import {listLocalStores} from './local-source.js'
import {STORE_LIST_LIMIT} from './constants.js'
import {type ListStoresResult, type StoreListOrganization, type StoreListRequestedSource} from './types.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import {isTTY} from '@shopify/cli-kit/node/ui'
import {fetchOrganizationsWithAccessInfo, selectOrganizationFromList, type Organization} from '@shopify/organizations'

interface ListStoresOptions {
  source?: StoreListRequestedSource
  organizationId?: string
}

type BusinessPlatformSessionResult =
  | {status: 'success'; token: string; organizations: Organization[]}
  | {status: 'unresolved-session'}
  | {status: 'unavailable'; error: unknown}

export async function listStores(options: ListStoresOptions = {}): Promise<ListStoresResult> {
  // A present-but-blank organization id (e.g. an empty `SHOPIFY_FLAG_ORGANIZATION_ID`) must not
  // silently widen the listing to every accessible organization.
  if (options.organizationId !== undefined && options.organizationId.trim() === '') {
    throw new AbortError(
      'The `--organization-id` value is empty.',
      'Provide an organization ID, for example `--organization-id 1234567`. Run `shopify organization list` to find IDs.',
    )
  }

  const requestedSource = options.source ?? 'auto'

  if (requestedSource === 'store-auth') {
    if (options.organizationId) {
      throw new AbortError(
        "`--organization-id` can't be combined with `--from store-auth`.",
        'Locally stored store auth is not organization-scoped. Drop `--organization-id` or use `--from organization`.',
      )
    }
    return storeAuthResult()
  }

  const canFallBackToStoreAuth = requestedSource === 'auto' && !options.organizationId
  const noPrompt = requestedSource === 'auto'
  const session = await resolveBusinessPlatformSession({noPrompt})

  if (session.status === 'unresolved-session') {
    if (canFallBackToStoreAuth) {
      return storeAuthResult(
        "Couldn't resolve a Shopify account for the current CLI session. Showing locally stored store auth instead.",
      )
    }

    return {
      stores: [],
      source: 'organization',
      notice: "Couldn't resolve a Shopify account for the current CLI session.",
    }
  }

  if (session.status === 'unavailable') {
    if (canFallBackToStoreAuth) {
      return storeAuthResult(
        "Couldn't list stores from your Shopify organization for the current CLI session. Showing locally stored store auth instead.",
      )
    }

    throw session.error
  }

  if (session.organizations.length === 0) {
    return {stores: [], source: 'organization'}
  }

  if (!options.organizationId && session.organizations.length > 1 && !isTTY()) {
    throw new AbortError(
      'An organization ID is required to list stores non-interactively.',
      'Provide `--organization-id`, for example `--organization-id 1234567`. Run `shopify organization list` to find IDs.',
    )
  }

  const selectedOrganization = await selectOrganizationFromList(session.organizations, options.organizationId)

  try {
    const result = await listBusinessPlatformStores({
      token: session.token,
      organization: selectedOrganization,
      noPrompt,
    })
    const {stores, truncated} = limitEntries(result.entries, result.hasMore ?? false)

    return {
      stores,
      source: 'organization',
      organization: storeListOrganization(selectedOrganization),
      ...(truncated ? {truncated: true} : {}),
    }
  } catch (error) {
    if (canFallBackToStoreAuth) {
      return storeAuthResult(
        "Couldn't list stores from your Shopify organization for the current CLI session. Showing locally stored store auth instead.",
      )
    }

    throw error
  }
}

async function resolveBusinessPlatformSession({noPrompt}: {noPrompt: boolean}): Promise<BusinessPlatformSessionResult> {
  try {
    const token = await ensureAuthenticatedBusinessPlatform([], {noPrompt})
    const organizationsResult = await fetchOrganizationsWithAccessInfo(token, {noPrompt})

    if (!organizationsResult.currentUserResolved) {
      return {status: 'unresolved-session'}
    }

    return {status: 'success', token, organizations: organizationsResult.organizations}
    // Authentication/session fetch failures are unavailable for `auto` fallback and strict for
    // `--from organization`.
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return {status: 'unavailable', error}
  }
}

function storeListOrganization(organization: Organization): StoreListOrganization {
  return {id: organization.id, name: organization.businessName}
}

function storeAuthResult(notice?: string): ListStoresResult {
  // Locally stored store auth is fully read, so truncation only happens if the cache exceeds the limit.
  const {stores, truncated} = limitEntries(listLocalStores(), false)

  return {
    source: 'store-auth',
    stores,
    ...(truncated ? {truncated: true} : {}),
    ...(notice ? {notice} : {}),
  }
}

// Caps the listing at STORE_LIST_LIMIT, keeping the already-sorted (newest-first) head. The result
// is truncated when the source reported more stores than it fetched, or when the selected source
// produced more than the limit.
function limitEntries<T>(entries: T[], hasMore: boolean): {stores: T[]; truncated: boolean} {
  return {stores: entries.slice(0, STORE_LIST_LIMIT), truncated: hasMore || entries.length > STORE_LIST_LIMIT}
}
