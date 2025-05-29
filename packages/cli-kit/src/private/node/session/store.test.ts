import {ApplicationToken, Sessions} from './schema.js'
import {store, fetch, remove} from './store.js'
import {getSessions, removeSessions, setSessions} from '../conf-store.js'
import {describe, expect, vi, test} from 'vitest'

vi.mock('../conf-store.js')

describe('store', () => {
  test('saves the serialized session to the local store', async () => {
    // Given
    const session = testSession()

    // When
    await store(session)

    // Then
    expect(setSessions).toHaveBeenCalled()
  })
})

describe('fetch', () => {
  test('reads the session from the local store', async () => {
    // When
    await fetch()

    // Then
    expect(getSessions).toHaveBeenCalled()
  })
})

describe('remove', () => {
  test('removes the session from the secure store', async () => {
    // When
    await remove()

    // Then
    expect(removeSessions).toHaveBeenCalled()
  })
})

function testSession(): Sessions {
  const testToken: ApplicationToken = {
    accessToken: 'access',
    expiresAt: new Date(),
    scopes: [],
  }
  return {
    'accounts.shopify.com': {
      '1234-5678': {
        identity: {
          accessToken: 'accessToken',
          refreshToken: 'refreshToken',
          expiresAt: new Date(),
          scopes: ['foo'],
          userId: '1234-5678',
        },
        applications: {
          adminApi: testToken,
          partnersApi: testToken,
          storefrontRendererApi: testToken,
        },
      },
    },
  }
}
