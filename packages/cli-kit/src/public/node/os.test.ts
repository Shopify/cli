import {platformAndArch, username, _resetUsernameCache} from './os.js'
import {describe, test, expect, vi, beforeEach} from 'vitest'
import {execa} from 'execa'
import {userInfo as osUserInfo} from 'os'

vi.mock('execa')
vi.mock('os', async (importOriginal) => {
  const original = (await importOriginal()) as any
  return {
    ...original,
    userInfo: vi.fn(),
  }
})

describe('username', () => {
  beforeEach(() => {
    _resetUsernameCache()
    vi.mocked(execa).mockClear()
    vi.mocked(osUserInfo).mockReturnValue({} as any)
    vi.stubEnv('USER', '')
    vi.stubEnv('SUDO_USER', '')
    vi.stubEnv('C9_USER', '')
    vi.stubEnv('LOGNAME', '')
    vi.stubEnv('LNAME', '')
    vi.stubEnv('USERNAME', '')
  })

  test('memoizes the result when platform matches process.platform', async () => {
    // Given
    if (process.platform === 'win32') {
      vi.mocked(execa).mockResolvedValue({stdout: 'domain\\user'} as any)
    } else {
      vi.mocked(execa).mockResolvedValueOnce({stdout: '123'} as any)
      vi.mocked(execa).mockResolvedValueOnce({stdout: 'user'} as any)
    }

    // When
    const firstResult = await username()
    const secondResult = await username()

    // Then
    expect(firstResult).toBe('user')
    expect(secondResult).toBe('user')
    if (process.platform === 'win32') {
      expect(execa).toHaveBeenCalledTimes(1)
      expect(execa).toHaveBeenCalledWith('whoami')
    } else {
      expect(execa).toHaveBeenCalledTimes(2)
      expect(execa).toHaveBeenNthCalledWith(1, 'id', ['-u'])
      expect(execa).toHaveBeenNthCalledWith(2, 'id', ['-un', '123'])
    }
  })

  test('does not memoize the result when platform does not match process.platform', async () => {
    // Given
    const otherPlatform = process.platform === 'win32' ? 'linux' : 'win32'
    if (otherPlatform === 'win32') {
      vi.mocked(execa).mockResolvedValue({stdout: 'domain\\user'} as any)
    } else {
      vi.mocked(execa).mockResolvedValue({stdout: 'user'} as any)
    }

    // When
    await username(otherPlatform)
    await username(otherPlatform)

    // Then
    if (otherPlatform === 'win32') {
      expect(execa).toHaveBeenCalledTimes(2)
    } else {
      // id -u is called each time, and potentially id -un
      expect(execa).toHaveBeenCalledTimes(4)
    }
  })
})

describe('platformAndArch', () => {
  test("returns the right architecture when it's x64", () => {
    // When
    const got = platformAndArch('darwin', 'x64')

    // Got
    expect(got.platform).toEqual('darwin')
    expect(got.arch).toEqual('amd64')
  })

  test("returns the right architecture when it's ia32", () => {
    // When
    const got = platformAndArch('darwin', 'ia32')

    // Got
    expect(got.platform).toEqual('darwin')
    expect(got.arch).toEqual('386')
  })

  test('returns the right architecture', () => {
    // When
    const got = platformAndArch('darwin', 'arm64')

    // Got
    expect(got.platform).toEqual('darwin')
    expect(got.arch).toEqual('arm64')
  })

  test('returns the right platform', () => {
    // When
    const got = platformAndArch('win32', 'arm64')

    // Got
    expect(got.platform).toEqual('windows')
    expect(got.arch).toEqual('arm64')
  })
})
