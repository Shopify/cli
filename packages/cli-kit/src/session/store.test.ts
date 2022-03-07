import {describe, expect, vi, it, beforeEach, afterEach} from 'vitest'

import {
  store as secureStore,
  fetch as secureFetch,
  remove as secureRemove,
} from '../secure-store'

import {ApplicationToken, Session} from './schema'
import {store, fetch, remove, identifier} from './store'

vi.mock('../secure-store')

describe('store', () => {
  it('serializes the session as a JSON when storing it', () => {
    // Given
    const session = testSession()

    // When
    store(session)

    // Then
    expect(vi.mocked(secureStore)).toHaveBeenCalledWith(
      identifier,
      JSON.stringify(session),
    )
  })
})

describe('fetch', () => {
  it('returns undefined when no session exists in the secure store', async () => {
    // Given
    vi.mocked(secureFetch).mockResolvedValue(null)

    // When
    const got = await fetch()

    // Then
    expect(got).toBeUndefined()
  })

  it('returns undefined when the content does not match the schema', async () => {
    // Given
    vi.mocked(secureFetch).mockResolvedValue(
      JSON.stringify({invalid: 'format'}),
    )

    // When
    const got = await fetch()

    // Then
    expect(got).toBeUndefined()
  })

  it('returns the session when the format is valid', async () => {
    // Given
    const session = testSession()
    vi.mocked(secureFetch).mockResolvedValue(JSON.stringify(session))

    // When
    const got = await fetch()

    // Then
    expect(got).toEqual(session)
  })
})

describe('remove', () => {
  it('removes the session from the secure store', () => {
    // When
    remove()

    // Then
    expect(vi.mocked(secureRemove)).toHaveBeenCalledWith(identifier)
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
