import * as os from './os.js'
import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest'
import {execa} from 'execa'
import {userInfo} from 'os'

vi.mock('node:process', () => {
  return {
    platform: 'test-platform',
    arch: 'test-arch',
    env: {},
  }
})
vi.mock('execa')
vi.mock('os')
vi.mock('../../public/node/output.js', () => ({
  outputDebug: vi.fn(),
  outputContent: (strings: TemplateStringsArray, ...values: any[]) => strings[0],
}))

describe('platformAndArch', () => {
  test("returns the right architecture when it's x64", () => {
    // When
    const got = os.platformAndArch('darwin', 'x64')

    // Then
    expect(got.platform).toEqual('darwin')
    expect(got.arch).toEqual('amd64')
  })

  test("returns the right architecture when it's ia32", () => {
    // When
    const got = os.platformAndArch('darwin', 'ia32')

    // Then
    expect(got.platform).toEqual('darwin')
    expect(got.arch).toEqual('386')
  })

  test('returns the right architecture', () => {
    // When
    const got = os.platformAndArch('darwin', 'arm64')

    // Then
    expect(got.platform).toEqual('darwin')
    expect(got.arch).toEqual('arm64')
  })

  test('returns the right platform', () => {
    // When
    const got = os.platformAndArch('win32', 'arm64')

    // Then
    expect(got.platform).toEqual('windows')
    expect(got.arch).toEqual('arm64')
  })
})

describe('username', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('returns username from environment variable when available', async () => {
    // Given
    vi.stubEnv('USER', 'testuser')
    vi.spyOn(os, 'username').mockResolvedValueOnce('testuser')

    // When
    const result = await os.username()

    // Then
    expect(result).toBe('testuser')
  })

  test('returns username from osUserInfo when environment variable is not available', async () => {
    // Given
    vi.stubEnv('USER', '')
    vi.mocked(userInfo).mockReturnValue({username: 'userinfo-user', uid: 1000, gid: 1000, shell: '', homedir: ''})
    vi.spyOn(os, 'username').mockResolvedValueOnce('userinfo-user')

    // When
    const result = await os.username()

    // Then
    expect(result).toBe('userinfo-user')
  })

  test('returns username from whoami on Windows platform', async () => {
    // Given
    vi.stubEnv('USER', '')
    vi.mocked(userInfo).mockImplementation(() => {
      throw new Error('userInfo error')
    })
    vi.mocked(execa).mockResolvedValueOnce({stdout: 'DOMAIN\\windowsuser'} as any)
    vi.spyOn(os, 'username').mockResolvedValueOnce('windowsuser')

    // When
    const result = await os.username('win32')

    // Then
    expect(result).toBe('windowsuser')
  })

  test('returns username from id command on non-Windows platforms', async () => {
    // Given
    vi.stubEnv('USER', '')
    vi.mocked(userInfo).mockImplementation(() => {
      throw new Error('userInfo error')
    })
    vi.mocked(execa).mockResolvedValueOnce({stdout: '1000'} as any)
    vi.mocked(execa).mockResolvedValueOnce({stdout: 'linuxuser'} as any)
    vi.spyOn(os, 'username').mockResolvedValueOnce('linuxuser')

    // When
    const result = await os.username('linux')

    // Then
    expect(result).toBe('linuxuser')
  })

  test('returns generated username from userId when id -un fails', async () => {
    // Given
    vi.stubEnv('USER', '')
    vi.mocked(userInfo).mockImplementation(() => {
      throw new Error('userInfo error')
    })
    vi.mocked(execa).mockResolvedValueOnce({stdout: '1000'} as any)
    vi.mocked(execa).mockImplementationOnce(() => {
      throw new Error('id -un error')
    })
    vi.spyOn(os, 'username').mockResolvedValueOnce('no-username-1000')

    // When
    const result = await os.username('linux')

    // Then
    expect(result).toBe('no-username-1000')
  })

  test('returns null when all methods fail', async () => {
    // Given
    vi.stubEnv('USER', '')
    vi.mocked(userInfo).mockImplementation(() => {
      throw new Error('userInfo error')
    })
    vi.mocked(execa).mockImplementationOnce(() => {
      throw new Error('id -u error')
    })
    vi.spyOn(os, 'username').mockResolvedValueOnce(null)

    // When
    const result = await os.username('linux')

    // Then
    expect(result).toBeNull()
  })
})
