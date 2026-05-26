import {hashString} from '@shopify/cli-kit/node/crypto'
import {addPublicMetadata, addSensitiveMetadata} from '@shopify/cli-kit/node/metadata'

export async function recordStoreFqdnMetadata(storeFqdn: string, validated: boolean): Promise<void> {
  await addSensitiveMetadata(() => ({store_fqdn: storeFqdn}))
  await addPublicMetadata(() => ({
    store_fqdn_hash: hashString(storeFqdn),
    store_fqdn_validated: validated,
    store_shop_domain: storeFqdn,
  }))
}
