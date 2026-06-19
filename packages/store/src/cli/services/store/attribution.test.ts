import {recordStoreFqdnMetadata} from './attribution.js'
import {hashString} from '@shopify/cli-kit/node/crypto'
import {addPublicMetadata, addSensitiveMetadata} from '@shopify/cli-kit/node/metadata'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/crypto')
vi.mock('@shopify/cli-kit/node/metadata')

describe('store command attribution', () => {
  beforeEach(() => {
    vi.mocked(hashString).mockReturnValue('hashed-store')
  })

  test('records the sensitive, hashed, validation, and public store domain for a store fqdn', async () => {
    await recordStoreFqdnMetadata('shop.myshopify.com', true)

    expect(addSensitiveMetadata).toHaveBeenCalledWith(expect.any(Function))
    expect(vi.mocked(addSensitiveMetadata).mock.calls[0]![0]()).toEqual({store_fqdn: 'shop.myshopify.com'})
    expect(addPublicMetadata).toHaveBeenCalledWith(expect.any(Function))
    expect(vi.mocked(addPublicMetadata).mock.calls[0]![0]()).toEqual({
      store_fqdn_hash: 'hashed-store',
      store_fqdn_validated: true,
      store_domain: 'shop.myshopify.com',
    })
    expect(hashString).toHaveBeenCalledWith('shop.myshopify.com')
  })

  test('records the numeric store id when provided', async () => {
    await recordStoreFqdnMetadata('shop.myshopify.com', true, '123')

    expect(vi.mocked(addPublicMetadata).mock.calls[0]![0]()).toEqual({
      store_fqdn_hash: 'hashed-store',
      store_fqdn_validated: true,
      store_domain: 'shop.myshopify.com',
      store_id: 123,
    })
  })
})
