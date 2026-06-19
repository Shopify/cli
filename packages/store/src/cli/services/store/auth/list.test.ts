import {listStoreAuthSessions} from './list.js'
import {listStoredStoreAuthSummaries} from './stored-auth.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('./stored-auth.js')

describe('listStoreAuthSessions', () => {
  test('projects stored store auth summaries into typed auth sessions', () => {
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

    expect(listStoreAuthSessions()).toEqual({
      sessions: [
        {
          kind: 'store',
          store: 'shop.myshopify.com',
          userId: '42',
          scopes: ['read_products'],
          connectedAt: '2026-03-27T00:00:00.000Z',
          expiresAt: '2026-03-28T00:00:00.000Z',
          refreshTokenExpiresAt: '2026-04-28T00:00:00.000Z',
          associatedUser: {id: 42, email: 'merchant@example.com'},
        },
      ],
    })
  })
})
