import {ApplicationToken, Session} from './schema.js'
import {store, fetch, remove} from './store.js'
import {getSession, removeSession, setSession} from '../conf-store.js'
import {describe, expect, vi, test} from 'vitest'

vi.mock('../conf-store.js')

const mockedGetSession = vi.mocked(getSession)
const mockedSetSession = vi.mocked(setSession)
const mockedRemoveSession = vi.mocked(removeSession)

describe('store', () => {
  test('saves the serialized session to the local store', async () => {
    // Given
    const session = testSession()

    // When
    await store(session)

    // Then
    expect(setSession).toHaveBeenCalledWith(JSON.stringify(session))
  })

  test('serializes session correctly before storing', async () => {
    // Given
    const session = testSession()
    const expectedJson = JSON.stringify(session)

    // When
    await store(session)

    // Then
    expect(setSession).toHaveBeenCalledWith(expectedJson)
  })
})

describe('fetch', () => {
  test('reads the session from the local store', async () => {
    // Given
    mockedGetSession.mockReturnValue(JSON.stringify(testSession()))

    // When
    await fetch()

    // Then
    expect(getSession).toHaveBeenCalled()
  })

  test('returns valid session when content exists and is valid', async () => {
    // Given
    const session = testSession()
    mockedGetSession.mockReturnValue(JSON.stringify(session))

    // When
    const result = await fetch()

    // Then
    expect(result).toEqual(session)
  })

  test('returns undefined when no content exists', async () => {
    // Given
    mockedGetSession.mockReturnValue(undefined)

    // When
    const result = await fetch()

    // Then
    expect(result).toBeUndefined()
  })

  test('returns undefined when content is null', async () => {
    // Given
    mockedGetSession.mockReturnValue(undefined)

    // When
    const result = await fetch()

    // Then
    expect(result).toBeUndefined()
  })

  test('handles invalid JSON gracefully', async () => {
    // Given
    mockedGetSession.mockReturnValue('invalid-json')

    // When/Then
    await expect(fetch()).rejects.toThrow()
  })

  test('removes session and returns undefined when schema validation fails', async () => {
    // Given
    const invalidSession = {
      'accounts.shopify.com': {
        identity: {
          accessToken: 'accessToken',
          // Missing required fields to make schema validation fail
        },
      },
    }
    mockedGetSession.mockReturnValue(JSON.stringify(invalidSession))

    // When
    const result = await fetch()

    // Then
    expect(result).toBeUndefined()
    expect(removeSession).toHaveBeenCalled()
  })

  test('removes session when content is empty object', async () => {
    // Given
    mockedGetSession.mockReturnValue(JSON.stringify({}))

    // When
    const result = await fetch()

    // Then
    expect(result).toBeUndefined()
    expect(removeSession).toHaveBeenCalled()
  })

  test('removes session when content has invalid structure', async () => {
    // Given
    const invalidStructure = {
      'accounts.shopify.com': {
        identity: {
          accessToken: 'accessToken',
          refreshToken: 'refreshToken',
          // Invalid date format
          expiresAt: 'invalid-date',
          // Invalid scopes format
          scopes: 'not-an-array',
          userId: '1234-5678',
        },
      },
    }
    mockedGetSession.mockReturnValue(JSON.stringify(invalidStructure))

    // When
    const result = await fetch()

    // Then
    expect(result).toBeUndefined()
    expect(removeSession).toHaveBeenCalled()
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
        userId: '1234-5678',
      },
      applications: {
        adminApi: testToken,
        partnersApi: testToken,
        storefrontRendererApi: testToken,
      },
    },
  }
}
