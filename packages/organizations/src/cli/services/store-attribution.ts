import {hashString} from '@shopify/cli-kit/node/crypto'
import {addPublicMetadata, addSensitiveMetadata} from '@shopify/cli-kit/node/metadata'
import {tryParseInt} from '@shopify/cli-kit/common/string'

interface RecordStoreFqdnMetadataOptions {
  /** The store's fully qualified domain name. */
  storeFqdn: string
  /** Whether the fqdn was confirmed against the platform, rather than taken from user input as-is. */
  validated: boolean
  /** The store's numeric id as a string. Ignored when it isn't numeric. */
  storeId?: string
}

/**
 * Records the store a command acted on, so command analytics can be grouped by store.
 *
 * @param options - The store to attribute the command to.
 */
export async function recordStoreFqdnMetadata(options: RecordStoreFqdnMetadataOptions): Promise<void> {
  const {storeFqdn, validated, storeId} = options

  await addSensitiveMetadata(() => ({store_fqdn: storeFqdn}))
  await addPublicMetadata(() => ({
    store_fqdn_hash: hashString(storeFqdn),
    store_fqdn_validated: validated,
    store_domain: storeFqdn,
    store_id: tryParseInt(storeId),
  }))
}
