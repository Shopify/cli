import {listLocalStores} from './local-source.js'
import {listStoredStoreAuthSummaries} from '../auth/index.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../auth/index.js')

describe('listLocalStores', () => {
  test('maps stored auth summaries to store-auth entries (store + connected date), newest first', () => {
    vi.mocked(listStoredStoreAuthSummaries).mockReturnValue([
      {
        store: 'a-shop.myshopify.com',
        userId: '42',
        scopes: ['read_products'],
        acquiredAt: '2026-03-27T00:00:00.000Z',
        associatedUser: {
          id: 42,
          email: 'merchant@example.com',
        },
      },
      {
        store: 'z-shop.myshopify.com',
        userId: '84',
        scopes: ['read_products'],
        acquiredAt: '2026-04-02T00:00:00.000Z',
      },
    ])

    expect(listLocalStores()).toEqual([
      {
        store: 'z-shop.myshopify.com',
        connectedAt: '2026-04-02T00:00:00.000Z',
      },
      {
        store: 'a-shop.myshopify.com',
        connectedAt: '2026-03-27T00:00:00.000Z',
      },
    ])
  })
})
