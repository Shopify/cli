import {ApplicationToken, Session} from './schema.js'
import {store, fetch, remove, identifier} from './store.js'
import {getSession, removeSession, setSession} from '../conf-store.js'
import {secureStoreSave, secureStoreFetch, secureStoreRemove} from '../secure-store.js'
import {platformAndArch} from '../../../public/node/os.js'
import {describe, expect, vi, it, beforeEach} from 'vitest'

const findCredentials = vi.fn()

beforeEach(() => {
  vi.resetAllMocks()
  vi.clearAllMocks()
  vi.mock('../secure-store.js')
  vi.mock('../conf-store.js')
  vi.mock('../../../public/node/os')
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
    expect(vi.mocked(secureStoreSave)).toHaveBeenCalledWith(identifier, JSON.stringify(session))
  })

  it('saves the serialized session to the local store on Windows', async () => {
    // Given
    const session = testSession()
    vi.mocked(platformAndArch).mockReturnValueOnce({platform: 'windows', arch: 'x64'})

    // When
    await store(session)

    // Then
    expect(setSession).toHaveBeenCalled()
  })

  it('saves the serialized session to the local store when keytar fails to load', async () => {
    // Given
    const session = testSession()
    vi.mocked(findCredentials).mockRejectedValueOnce(new Error('Not found'))

    // When
    await store(session)

    // Then
    expect(setSession).toHaveBeenCalledWith(JSON.stringify(session))
  })
})

describe('fetch', () => {
  it('returns undefined when no session exists in the secure store', async () => {
    // Given
    vi.mocked(secureStoreFetch).mockResolvedValue(null)

    // When
    const got = await fetch()

    // Then
    expect(got).toBeUndefined()
  })

  it('returns undefined when the content does not match the schema', async () => {
    // Given
    vi.mocked(secureStoreFetch).mockResolvedValue(JSON.stringify({invalid: 'format'}))

    // When
    const got = await fetch()

    // Then
    expect(got).toBeUndefined()
  })

  it('returns the session when the format is valid', async () => {
    // Given
    const session = testSession()
    vi.mocked(secureStoreFetch).mockResolvedValue(JSON.stringify(session))

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
    expect(getSession).toHaveBeenCalled()
  })

  it('reads the session from the local store when keytar fails to load', async () => {
    // Given
    vi.mocked(findCredentials).mockRejectedValueOnce(new Error('Not found'))

    // When
    await fetch()

    // Then
    expect(getSession).toHaveBeenCalled()
  })
})

describe('remove', () => {
  it('removes the session from the secure store', async () => {
    // When
    await remove()

    // Then
    expect(vi.mocked(secureStoreRemove)).toHaveBeenCalledWith(identifier)
  })

  it('removes the session from the secure store on Windows', async () => {
    // Given
    vi.mocked(platformAndArch).mockReturnValueOnce({platform: 'windows', arch: 'x64'})

    // When
    await remove()

    // Then
    expect(removeSession).toHaveBeenCalled()
  })

  it('removes the session from the secure store when keytar fails to load', async () => {
    // Given
    vi.mocked(findCredentials).mockRejectedValueOnce(new Error('Not found'))

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
