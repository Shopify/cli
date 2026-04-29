import {recordStoreCommandUserId, recordStoreFqdnMetadata} from './metrics.js'
import {hashString} from '@shopify/cli-kit/node/crypto'
import {addPublicMetadata} from '@shopify/cli-kit/node/metadata'
import {setLastSeenUserId} from '@shopify/cli-kit/node/session'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/crypto')
vi.mock('@shopify/cli-kit/node/metadata')
vi.mock('@shopify/cli-kit/node/session')

describe('store command metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(hashString).mockReturnValue('hashed-store')
  })

  test('records the hashed store fqdn', async () => {
    await recordStoreFqdnMetadata('shop.myshopify.com')

    expect(addPublicMetadata).toHaveBeenCalledWith(expect.any(Function))
    expect(vi.mocked(addPublicMetadata).mock.calls[0]![0]()).toEqual({store_fqdn_hash: 'hashed-store'})
    expect(hashString).toHaveBeenCalledWith('shop.myshopify.com')
  })

  test('sets the command analytics user id from store auth identity', () => {
    recordStoreCommandUserId('42')

    expect(setLastSeenUserId).toHaveBeenCalledWith('42')
  })
})
