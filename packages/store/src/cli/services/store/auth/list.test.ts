import {listStoreAuthSessions} from './list.js'
import {storeAuthListJsonOutputSchema} from './list-types.js'
import {listStoredStoreAuthSummaries} from './stored-auth.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('./stored-auth.js')

describe('listStoreAuthSessions', () => {
  test('projects stored store auth summaries into the typed result contract', () => {
    vi.mocked(listStoredStoreAuthSummaries).mockReturnValue([
      {
        store: 'shop.myshopify.com',
        userId: '42',
        scopes: ['read_products'],
        acquiredAt: '2026-03-27T00:00:00.000Z',
        expiresAt: '2026-03-28T00:00:00.000Z',
        refreshTokenExpiresAt: '2026-04-28T00:00:00.000Z',
        associatedUser: {id: 42, email: 'merchant@example.com'},
      },
    ])

    const result = listStoreAuthSessions()

    expect(result).toEqual({
      sessions: [
        {
          subdomain: 'shop',
          connected: 'Mar 27, 2026',
        },
      ],
    })
    expect(storeAuthListJsonOutputSchema.validate(result)).toEqual(result)
  })

  test('includes the existing guidance when there are no sessions', () => {
    vi.mocked(listStoredStoreAuthSummaries).mockReturnValue([])

    expect(listStoreAuthSessions()).toEqual({
      sessions: [],
      message: [
        'No stores are authenticated directly with `shopify store auth`.',
        '',
        'Run `shopify store auth --store <domain> --scopes <scopes>` to authenticate a store.',
        'Run `shopify store list` to list stores in a Shopify organization.',
      ].join('\n'),
    })
  })
})
