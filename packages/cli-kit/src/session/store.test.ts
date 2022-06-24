import {ApplicationToken, Session} from './schema'
import {store, fetch, remove, identifier} from './store'
import {setSessionStore as localStore, removeSessionStore as localRemove, getSessionStore as localFetch} from '../store'
import {store as secureStore, fetch as secureFetch, remove as secureRemove} from '../secure-store'
import {platformAndArch} from '../os'
import {describe, expect, vi, it, beforeEach} from 'vitest'

const findCredentials = vi.fn()

beforeEach(() => {
  vi.resetAllMocks()
  vi.clearAllMocks()
  vi.mock('../secure-store')
  vi.mock('../store')
  vi.mock('../os')
  vi.mocked(platformAndArch).mockReturnValue({platform: 'darwin', arch: 'x64'})
  vi.mock('keytar', () => {
    return {
      default: {
        findCredentials,
      },
    }
  })
})

describe('store', () => {
  it('saves the serialized session to the secure store', async () => {
    // Given
    const session = testSession()

    // When
    await store(session)

    // Then
    expect(vi.mocked(secureStore)).toHaveBeenCalledWith(identifier, JSON.stringify(session))
  })

  it('saves the serialized session to the local store on Windows', async () => {
    // Given
    const session = testSession()
    vi.mocked(platformAndArch).mockReturnValueOnce({platform: 'windows', arch: 'x64'})

    // When
    await store(session)

    // Then
    expect(vi.mocked(localStore)).toHaveBeenCalledWith(JSON.stringify(session))
  })

  it('saves the serialized session to the local store when keytar fails to load', async () => {
    // Given
    const session = testSession()
    vi.mocked(findCredentials).mockRejectedValueOnce(new Error('Not found'))

    // When
    await store(session)

    // Then
    expect(vi.mocked(localStore)).toHaveBeenCalledWith(JSON.stringify(session))
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
    vi.mocked(secureFetch).mockResolvedValue(JSON.stringify({invalid: 'format'}))

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

  it('reads the session from the local store on Windows', async () => {
    // Given
    vi.mocked(platformAndArch).mockReturnValueOnce({platform: 'windows', arch: 'x64'})

    // When
    await fetch()

    // Then
    expect(vi.mocked(localFetch)).toHaveBeenCalled()
  })

  it('reads the session from the local store when keytar fails to load', async () => {
    // Given
    vi.mocked(findCredentials).mockRejectedValueOnce(new Error('Not found'))

    // When
    await fetch()

    // Then
    expect(vi.mocked(localFetch)).toHaveBeenCalled()
  })
})

describe('remove', () => {
  it('removes the session from the secure store', async () => {
    // When
    await remove()

    // Then
    expect(vi.mocked(secureRemove)).toHaveBeenCalledWith(identifier)
  })

  it('removes the session from the secure store on Windows', async () => {
    // Given
    vi.mocked(platformAndArch).mockReturnValueOnce({platform: 'windows', arch: 'x64'})

    // When
    await remove()

    // Then
    expect(vi.mocked(localRemove)).toHaveBeenCalled()
  })

  it('removes the session from the secure store when keytar fails to load', async () => {
    // Given
    vi.mocked(findCredentials).mockRejectedValueOnce(new Error('Not found'))

    // When
    await remove()

    // Then
    expect(vi.mocked(localRemove)).toHaveBeenCalled()
  })
})

function testSession(): Session {
  const testToken: ApplicationToken = {
    accessToken: 'access',
    expiresAt: new Date(),
    scopes: [],
  }
  return {
    // eslint-disable-next-line @typescript-eslint/naming-convention
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
