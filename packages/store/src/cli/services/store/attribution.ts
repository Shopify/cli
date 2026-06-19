import {hashString} from '@shopify/cli-kit/node/crypto'
import {addPublicMetadata, addSensitiveMetadata} from '@shopify/cli-kit/node/metadata'
import {tryParseInt} from '@shopify/cli-kit/common/string'

export async function recordStoreFqdnMetadata(storeFqdn: string, validated: boolean, storeId?: string): Promise<void> {
  await addSensitiveMetadata(() => ({store_fqdn: storeFqdn}))
  await addPublicMetadata(() => ({
    store_fqdn_hash: hashString(storeFqdn),
    store_fqdn_validated: validated,
    store_domain: storeFqdn,
    store_id: tryParseInt(storeId),
  }))
}
