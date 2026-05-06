import {recordStoreCommandShopIdFromAdminGid, recordStoreFqdnMetadata} from './metrics.js'
import {hashString} from '@shopify/cli-kit/node/crypto'
import {addPublicMetadata, addSensitiveMetadata} from '@shopify/cli-kit/node/metadata'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/crypto')
vi.mock('@shopify/cli-kit/node/metadata')

describe('store command metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(hashString).mockReturnValue('hashed-store')
  })

  test('records the sensitive and hashed store fqdn', async () => {
    await recordStoreFqdnMetadata('shop.myshopify.com')

    expect(addSensitiveMetadata).toHaveBeenCalledWith(expect.any(Function))
    expect(vi.mocked(addSensitiveMetadata).mock.calls[0]![0]()).toEqual({store_fqdn: 'shop.myshopify.com'})
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
})
