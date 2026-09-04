import {listBusinessPlatformStores} from './list/bp-source.js'
import {type StoreListEntry} from './list/types.js'
import {DEV_STORE_TYPE_FILTER} from './store-type.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import {selectOrg, storeChoiceList, type Organization, type StoreChoice} from '@shopify/organizations'
import {renderAutocompletePrompt} from '@shopify/cli-kit/node/ui'

interface SelectDevStoreOptions {
  // The `--organization-id` flag value, when one was given. Skips the organization prompt.
  organizationId?: string
  // The question shown above the store choices.
  message: string
}

export interface SelectedDevStore {
  store: string
  organization: Organization
}

/**
 * Prompts for a dev store when a command was run without `--store`: first for the organization that
 * owns it (skipped when `--organization-id` was given, or when only one organization is available),
 * then for one of that organization's dev stores.
 */
export async function selectDevStore(options: SelectDevStoreOptions): Promise<SelectedDevStore> {
  const organization = await selectOrg(options.organizationId)
  const token = await ensureAuthenticatedBusinessPlatform()
  const listDevStores = async (searchTerm?: string) => {
    const {entries, hasMore} = await listBusinessPlatformStores({
      token,
      organization,
      storeTypeFilter: DEV_STORE_TYPE_FILTER,
      ...(searchTerm ? {searchTerm} : {}),
    })

    return {stores: entries, hasMorePages: hasMore}
  }

  const {stores, hasMorePages} = await listDevStores()
  if (stores.length === 0) {
    throw new AbortError(
      `No dev stores found in ${organization.businessName}.`,
      `Create one with \`shopify store create dev --organization-id ${organization.id}\`.`,
    )
  }

  const {promptProps, storeFor} = storeChoiceList({stores, toChoice: toStoreChoice, onSearch: listDevStores})

  // A lone dev store is still offered as a choice rather than auto-selected: the caller is about to
  // act on it, so the developer should see which store that is before confirming.
  const selectedValue = await renderAutocompletePrompt({message: options.message, hasMorePages, ...promptProps})
  const selected = storeFor(selectedValue)

  // Every choice offered is a store, so the prompt can only submit one we can resolve.
  if (!selected) throw new AbortError('No dev store was selected.')

  return {store: selected.store, organization}
}

function toStoreChoice(entry: StoreListEntry): StoreChoice {
  return {id: entry.store, domain: entry.store, ...(entry.name ? {name: entry.name} : {})}
}
