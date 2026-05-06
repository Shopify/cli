import {recordStoreFqdnMetadata} from './attribution.js'
import {hashString} from '@shopify/cli-kit/node/crypto'
import {addPublicMetadata, addSensitiveMetadata} from '@shopify/cli-kit/node/metadata'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/crypto')
vi.mock('@shopify/cli-kit/node/metadata')

describe('store command attribution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(hashString).mockReturnValue('hashed-store')
  })

  test('records the sensitive, hashed, and validation state for a store fqdn', async () => {
    await recordStoreFqdnMetadata('shop.myshopify.com', true)

    expect(addSensitiveMetadata).toHaveBeenCalledWith(expect.any(Function))
    expect(vi.mocked(addSensitiveMetadata).mock.calls[0]![0]()).toEqual({store_fqdn: 'shop.myshopify.com'})
    expect(addPublicMetadata).toHaveBeenCalledWith(expect.any(Function))
    expect(vi.mocked(addPublicMetadata).mock.calls[0]![0]()).toEqual({
      store_fqdn_hash: 'hashed-store',
      store_fqdn_validated: true,
    })
    expect(hashString).toHaveBeenCalledWith('shop.myshopify.com')
  })
})
