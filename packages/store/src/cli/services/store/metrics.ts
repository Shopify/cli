import {hashString} from '@shopify/cli-kit/node/crypto'
import {addPublicMetadata} from '@shopify/cli-kit/node/metadata'

export async function recordStoreFqdnMetadata(storeFqdn: string): Promise<void> {
  await addPublicMetadata(() => ({store_fqdn_hash: hashString(storeFqdn)}))
}
