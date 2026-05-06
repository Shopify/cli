import {hashString} from '@shopify/cli-kit/node/crypto'
import {addPublicMetadata, addSensitiveMetadata} from '@shopify/cli-kit/node/metadata'
import {tryParseInt} from '@shopify/cli-kit/common/string'

export async function recordStoreFqdnMetadata(storeFqdn: string): Promise<void> {
  await addSensitiveMetadata(() => ({store_fqdn: storeFqdn}))
  await addPublicMetadata(() => ({store_fqdn_hash: hashString(storeFqdn)}))
}

export async function recordStoreCommandShopIdFromAdminGid(shopGid: string | undefined): Promise<void> {
  const shopId = numericIdFromShopGid(shopGid)
  if (shopId === undefined) return

  await addPublicMetadata(() => ({shop_id: shopId}))
}

function numericIdFromShopGid(gid: string | undefined): number | undefined {
  const id = gid?.match(/^gid:\/\/shopify\/Shop\/(\d+)$/)?.[1]
  return tryParseInt(id)
}
