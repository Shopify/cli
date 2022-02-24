import {describe, expect, vi, it, beforeEach, afterEach} from 'vitest'

import {
  store as secureStore,
  fetch as secureFetch,
  remove as secureRemove,
} from '../secure-store'

import {store, fetch, remove, identifier} from './store'

const mockedSecureStore = vi.mocked(secureStore)
const mockedSecureFetch = vi.mocked(secureFetch)
const mockedSecureRemove = vi.mocked(secureRemove)

describe('store', () => {
  it('serializes the session as a JSON when storing it', () => {
    // Given
    const session = testSession()

    // When
    store(session)

    // Then
    expect(mockedSecureStore).toHaveBeenCalledWith(
      identifier,
      JSON.stringify(session),
    )
  })
})

describe('fetch', () => {
  it('returns undefined when no session exists in the secure store', async () => {
    // Given
    mockedSecureFetch.mockResolvedValue(null)

    // When
    const got = await fetch()

    // Then
    expect(got).toBeUndefined()
  })

  it('returns undefined when the content does not match the schema', async () => {
    // Given
    mockedSecureFetch.mockResolvedValue(JSON.stringify({invalid: 'format'}))

    // When
    const got = await fetch()

    // Then
    expect(got).toBeUndefined()
  })

  it('returns the session when the format is valid', async () => {
    // Given
    const session = testSession()
    mockedSecureFetch.mockResolvedValue(JSON.stringify(session))

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
    expect(mockedSecureRemove).toHaveBeenCalledWith(identifier)
  })
})

function testSession() {
  return {
    'accounts.shopify.com': {
      identity: {
        accessToken: 'accessToken',
        refreshToken: 'refreshToken',
        expiresAt: new Date(),
        scopes: ['foo'],
      },
      applications: {
        adminApi: {},
        partnersApi: {},
        storefrontRendererApi: {},
      },
    },
  }
}
