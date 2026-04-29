import {hashString} from '@shopify/cli-kit/node/crypto'
import {addPublicMetadata} from '@shopify/cli-kit/node/metadata'
import {setLastSeenUserId} from '@shopify/cli-kit/node/session'

export async function recordStoreFqdnMetadata(storeFqdn: string): Promise<void> {
  await addPublicMetadata(() => ({store_fqdn_hash: hashString(storeFqdn)}))
}

export function recordStoreCommandUserId(userId: string): void {
  setLastSeenUserId(userId)
}
