import {recordStoreCommandShopIdFromAdminApi, recordStoreCommandShopIdFromAdminGid, recordStoreFqdnMetadata} from './metrics.js'
import {adminUrl} from '@shopify/cli-kit/node/api/admin'
import {graphqlRequest} from '@shopify/cli-kit/node/api/graphql'
import {hashString} from '@shopify/cli-kit/node/crypto'
import {addPublicMetadata} from '@shopify/cli-kit/node/metadata'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/api/admin')
vi.mock('@shopify/cli-kit/node/api/graphql')
vi.mock('@shopify/cli-kit/node/crypto')
vi.mock('@shopify/cli-kit/node/metadata')

describe('store command metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(adminUrl).mockReturnValue('https://shop.myshopify.com/admin/api/unstable/graphql.json')
    vi.mocked(hashString).mockReturnValue('hashed-store')
  })

  test('records the hashed store fqdn', async () => {
    await recordStoreFqdnMetadata('shop.myshopify.com')

    expect(addPublicMetadata).toHaveBeenCalledWith(expect.any(Function))
    expect(vi.mocked(addPublicMetadata).mock.calls[0]![0]()).toEqual({store_fqdn_hash: 'hashed-store'})
    expect(hashString).toHaveBeenCalledWith('shop.myshopify.com')
  })

  test('records numeric shop_id from an Admin Shop gid', async () => {
    await recordStoreCommandShopIdFromAdminGid('gid://shopify/Shop/123')

    expect(addPublicMetadata).toHaveBeenCalledWith(expect.any(Function))
    expect(vi.mocked(addPublicMetadata).mock.calls[0]![0]()).toEqual({shop_id: 123})
  })

  test('ignores malformed Admin Shop gids', async () => {
    await recordStoreCommandShopIdFromAdminGid('gid://shopify/Product/123')

    expect(addPublicMetadata).not.toHaveBeenCalled()
  })

  test('fetches and records shop_id from the Admin API', async () => {
    vi.mocked(graphqlRequest).mockResolvedValue({shop: {id: 'gid://shopify/Shop/456'}})

    await recordStoreCommandShopIdFromAdminApi({store: 'shop.myshopify.com', accessToken: 'token'})

    expect(adminUrl).toHaveBeenCalledWith('shop.myshopify.com', 'unstable')
    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        api: 'Admin',
        token: 'token',
        url: 'https://shop.myshopify.com/admin/api/unstable/graphql.json',
        responseOptions: {handleErrors: false},
      }),
    )
    expect(vi.mocked(addPublicMetadata).mock.calls[0]![0]()).toEqual({shop_id: 456})
  })
})
