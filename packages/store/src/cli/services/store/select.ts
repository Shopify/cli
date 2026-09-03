import {listBusinessPlatformStores} from './list/bp-source.js'
import {STORE_LIST_LIMIT} from './list/constants.js'
import {type StoreListEntry} from './list/types.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputWarn} from '@shopify/cli-kit/node/output'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import {renderAutocompletePrompt} from '@shopify/cli-kit/node/ui'
import {selectOrg, type Organization} from '@shopify/organizations'

// The `store list` type handle every dev store variant maps to.
const DEV_STORE_TYPE = 'dev'

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
  const devStores = await fetchDevStores(organization)

  if (devStores.length === 0) {
    throw new AbortError(
      `No dev stores found in ${organization.businessName}.`,
      `Create one with \`shopify store create dev --organization-id ${organization.id}\`.`,
    )
  }

  const store = await renderAutocompletePrompt({
    message: options.message,
    choices: devStores.map(toStoreChoice),
  })

  return {store, organization}
}

// Reuses the `store list` source, so the choices are the organization's newest stores, and narrows
// them to the dev stores the caller can act on. A store beyond the fetched page can still be named
// with `--store`, so truncation is reported rather than treated as an error.
async function fetchDevStores(organization: Organization): Promise<StoreListEntry[]> {
  const token = await ensureAuthenticatedBusinessPlatform()
  const {entries, hasMore} = await listBusinessPlatformStores({token, organization})

  if (hasMore) outputWarn(truncationWarning(organization))

  return entries.filter((entry) => entry.type === DEV_STORE_TYPE)
}

function truncationWarning(organization: Organization): string {
  return `Showing the dev stores among the ${STORE_LIST_LIMIT} most recent stores in ${organization.businessName}. More stores exist: use \`--store\` to name one that isn't listed.`
}

function toStoreChoice(entry: StoreListEntry): {label: string; value: string} {
  return {label: entry.name ? `${entry.name} (${entry.store})` : entry.store, value: entry.store}
}
