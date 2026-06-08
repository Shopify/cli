import {platformAndArch, username} from './os.js'
import {describe, test, expect, vi, beforeEach} from 'vitest'
import {execa} from 'execa'
import {userInfo as osUserInfo} from 'os'

vi.mock('node:process', () => ({
  default: {
    platform: 'linux',
    arch: 'x64',
    env: {},
    argv: [],
  },
}))
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
    vi.mocked(execa).mockResolvedValue({stdout: '123'} as any)
    // First call to id -u, second to id -un 123
    vi.mocked(execa).mockResolvedValueOnce({stdout: '123'} as any)
    vi.mocked(execa).mockResolvedValueOnce({stdout: 'user'} as any)

    // When
    const firstResult = await username('linux')
    const secondResult = await username('linux')

    // Then
    expect(firstResult).toBe('user')
    expect(secondResult).toBe('user')
    expect(execa).toHaveBeenCalledTimes(2)
  })

  test('does not memoize the result when platform does not match process.platform', async () => {
    // Given
    vi.mocked(execa).mockResolvedValue({stdout: 'user'} as any)

    // When
    await username('win32')
    await username('win32')

    // Then
    expect(execa).toHaveBeenCalledTimes(2)
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
