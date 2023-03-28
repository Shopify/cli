import {ApplicationToken, Session} from './schema.js'
import {store, fetch, remove} from './store.js'
import {getSession, removeSession, setSession} from '../conf-store.js'
import {describe, expect, vi, test} from 'vitest'

vi.mock('../conf-store.js')

describe('store', () => {
  test('saves the serialized session to the local store', async () => {
    // Given
    const session = testSession()

    // When
    await store(session)

    // Then
    expect(setSession).toHaveBeenCalled()
  })
})

describe('fetch', () => {
  test('reads the session from the local store', async () => {
    // When
    await fetch()

    // Then
    expect(getSession).toHaveBeenCalled()
  })
})

describe('remove', () => {
  test('removes the session from the secure store', async () => {
    // When
    await remove()

    // Then
    expect(removeSession).toHaveBeenCalled()
  })
})

function testSession(): Session {
  const testToken: ApplicationToken = {
    accessToken: 'access',
    expiresAt: new Date(),
    scopes: [],
  }
  return {
    'accounts.shopify.com': {
      identity: {
        accessToken: 'accessToken',
        refreshToken: 'refreshToken',
        expiresAt: new Date(),
        scopes: ['foo'],
      },
      applications: {
        adminApi: testToken,
        partnersApi: testToken,
        storefrontRendererApi: testToken,
      },
    },
  }
}
