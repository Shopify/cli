import {platformAndArch, username} from './os.js'
import {execa} from 'execa'
import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest'
import {userInfo} from 'os'

vi.mock('node:process')
vi.mock('execa')
vi.mock('os', async (importOriginal) => {
  const original = await importOriginal<typeof import('os')>()
  return {
    ...original,
    userInfo: vi.fn(),
  }
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

describe('username', () => {
  const originalEnv = {...process.env}

  beforeEach(() => {
    // Clear environment variables that might interfere
    delete process.env.SUDO_USER
    delete process.env.C9_USER
    delete process.env.LOGNAME
    delete process.env.USER
    delete process.env.LNAME
    delete process.env.USERNAME
  })

  afterEach(() => {
    process.env = {...originalEnv}
  })

  test('returns the username from environment variables (e.g. SUDO_USER)', async () => {
    // Given
    process.env.SUDO_USER = 'sudo_user'

    // When
    const got = await username()

    // Then
    expect(got).toEqual('sudo_user')
  })

  test('falls back to getUsernameFromOsUserInfo when environment variables are not set', async () => {
    // Given
    vi.mocked(userInfo).mockReturnValue({username: 'os_user'} as any)

    // When
    const got = await username()

    // Then
    expect(got).toEqual('os_user')
  })

  test('falls back to win32 command whoami when env vars and userInfo are empty or failing', async () => {
    // Given
    vi.mocked(userInfo).mockImplementation(() => {
      throw new Error('userInfo failed')
    })
    vi.mocked(execa).mockResolvedValue({stdout: 'domain\\win_user'} as any)

    // When
    const got = await username('win32')

    // Then
    expect(got).toEqual('win_user')
    expect(execa).toHaveBeenCalledWith('whoami')
  })

  test('falls back to Unix command id when env vars and userInfo are empty or failing', async () => {
    // Given
    vi.mocked(userInfo).mockImplementation(() => {
      throw new Error('userInfo failed')
    })
    // First call to id -u returns 1001, second call to id -un 1001 returns unix_user
    vi.mocked(execa)
      .mockResolvedValueOnce({stdout: '1001'} as any)
      .mockResolvedValueOnce({stdout: 'unix_user'} as any)

    // When
    const got = await username('darwin')

    // Then
    expect(got).toEqual('unix_user')
    expect(execa).toHaveBeenNthCalledWith(1, 'id', ['-u'])
    expect(execa).toHaveBeenNthCalledWith(2, 'id', ['-un', '1001'])
  })

  test('falls back to no-username-ID if Unix lookup fails on name resolution', async () => {
    // Given
    vi.mocked(userInfo).mockImplementation(() => {
      throw new Error('userInfo failed')
    })
    vi.mocked(execa)
      .mockResolvedValueOnce({stdout: '1002'} as any)
      .mockRejectedValueOnce(new Error('id -un failed'))

    // When
    const got = await username('linux')

    // Then
    expect(got).toEqual('no-username-1002')
    expect(execa).toHaveBeenNthCalledWith(1, 'id', ['-u'])
    expect(execa).toHaveBeenNthCalledWith(2, 'id', ['-un', '1002'])
  })

  test('returns null when all lookups fail', async () => {
    // Given
    vi.mocked(userInfo).mockImplementation(() => {
      throw new Error('userInfo failed')
    })
    vi.mocked(execa).mockRejectedValue(new Error('execa failed'))

    // When
    const got = await username('darwin')

    // Then
    expect(got).toBeNull()
  })
})
