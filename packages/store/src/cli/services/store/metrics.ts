import {adminUrl} from '@shopify/cli-kit/node/api/admin'
import {graphqlRequest} from '@shopify/cli-kit/node/api/graphql'
import {hashString} from '@shopify/cli-kit/node/crypto'
import {addPublicMetadata} from '@shopify/cli-kit/node/metadata'
import {outputContent, outputDebug, outputToken} from '@shopify/cli-kit/node/output'
import {tryParseInt} from '@shopify/cli-kit/common/string'

const STORE_ID_QUERY = `#graphql
  query StoreCommandShopId {
    shop {
      id
    }
  }
`

interface StoreIdResponse {
  shop?: {
    id?: string
  }
}

export async function recordStoreFqdnMetadata(storeFqdn: string): Promise<void> {
  await addPublicMetadata(() => ({store_fqdn_hash: hashString(storeFqdn)}))
}

export async function recordStoreCommandShopIdFromAdminGid(shopGid: string | undefined): Promise<void> {
  const shopId = numericIdFromShopGid(shopGid)
  if (shopId === undefined) return

  await addPublicMetadata(() => ({shop_id: shopId}))
}

export async function recordStoreCommandShopIdFromAdminApi(options: {
  store: string
  accessToken: string
}): Promise<void> {
  try {
    const response = await graphqlRequest<StoreIdResponse>({
      query: STORE_ID_QUERY,
      api: 'Admin',
      url: adminUrl(options.store, 'unstable'),
      token: options.accessToken,
      responseOptions: {handleErrors: false},
    })
    await recordStoreCommandShopIdFromAdminGid(response.shop?.id)
  } catch (error) {
    outputDebug(
      outputContent`Failed to record store command shop_id for ${outputToken.raw(options.store)}: ${outputToken.raw(
        error instanceof Error ? error.message : String(error),
      )}`,
    )
  }
}

function numericIdFromShopGid(gid: string | undefined): number | undefined {
  const id = gid?.match(/^gid:\/\/shopify\/Shop\/(\d+)$/)?.[1]
  return tryParseInt(id)
}
