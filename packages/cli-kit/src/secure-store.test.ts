import {platformAndArch} from './os'
import {secureStoreAvailable} from './secure-store'
import {beforeEach, describe, expect, it, vi} from 'vitest'

beforeEach(() => {
  vi.mock('./os')
  vi.mock('keytar')
})

describe('secureStoreAvailable', () => {
  it('returns true when keytar is available in Mac', async () => {
    // Given
    vi.mocked(platformAndArch).mockReturnValue({platform: 'darwin', arch: 'x64'})

    // When
    const got = await secureStoreAvailable()

    // Then
    expect(got).toEqual(true)
  })

  it('returns true when keytar is available in Linux', async () => {
    // Given
    vi.mocked(platformAndArch).mockReturnValue({platform: 'linux', arch: 'x64'})

    // When
    const got = await secureStoreAvailable()

    // Then
    expect(got).toEqual(true)
  })

  it('returns false in Windows', async () => {
    // Given
    vi.mocked(platformAndArch).mockReturnValueOnce({platform: 'windows', arch: 'x64'})

    // When
    const got = await secureStoreAvailable()

    // Then
    expect(got).toEqual(false)
  })

  it('returns false if keytar is not available', async () => {
    // Given
    vi.mocked(platformAndArch).mockReturnValueOnce({platform: 'linux', arch: 'x64'})
    const keytar = async () => Promise.reject(new Error('Not found'))

    // When
    const got = await secureStoreAvailable(keytar)

    // Then
    expect(got).toEqual(false)
  })

  it('returns false if findCredentials from keytar fails', async () => {
    // Given
    vi.mocked(platformAndArch).mockReturnValueOnce({platform: 'linux', arch: 'x64'})
    const keytar = async () => {
      return {
        default: {
          findCredentials: () => Promise.reject(new Error('Not found')),
          getPassword: vi.fn(),
          setPassword: vi.fn(),
          deletePassword: vi.fn(),
          findPassword: vi.fn(),
        },
      }
    }

    // When
    const got = await secureStoreAvailable(keytar)

    // Then
    expect(got).toEqual(false)
  })
})
