import {platformAndArch, username} from './os.js'
import {execa} from 'execa'
import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest'
import {userInfo as osUserInfo} from 'os'

vi.mock('node:process')
vi.mock('execa')
vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>()
  return {
    ...actual,
    userInfo: vi.fn(),
  }
})
vi.mock('./output.js')

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
  beforeEach(() => {
    vi.stubEnv('SUDO_USER', '')
    vi.stubEnv('C9_USER', '')
    vi.stubEnv('LOGNAME', '')
    vi.stubEnv('USER', '')
    vi.stubEnv('LNAME', '')
    vi.stubEnv('USERNAME', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('returns SUDO_USER if set', async () => {
    vi.stubEnv('SUDO_USER', 'sudo-user-name')

    const got = await username()

    expect(got).toEqual('sudo-user-name')
    expect(osUserInfo).not.toHaveBeenCalled()
    expect(execa).not.toHaveBeenCalled()
  })

  test('returns USER if USER is set and SUDO_USER/C9_USER/LOGNAME are not', async () => {
    vi.stubEnv('USER', 'user-name')

    const got = await username()

    expect(got).toEqual('user-name')
    expect(osUserInfo).not.toHaveBeenCalled()
    expect(execa).not.toHaveBeenCalled()
  })

  test('returns C9_USER if set and SUDO_USER is not', async () => {
    vi.stubEnv('C9_USER', 'c9-user-name')
    const got = await username()
    expect(got).toEqual('c9-user-name')
  })

  test('returns LOGNAME if set and SUDO_USER/C9_USER are not', async () => {
    vi.stubEnv('LOGNAME', 'logname-user-name')
    const got = await username()
    expect(got).toEqual('logname-user-name')
  })

  test('returns LNAME if set and SUDO_USER/C9_USER/LOGNAME/USER are not', async () => {
    vi.stubEnv('LNAME', 'lname-user-name')
    const got = await username()
    expect(got).toEqual('lname-user-name')
  })

  test('returns USERNAME if set and others are not', async () => {
    vi.stubEnv('USERNAME', 'username-user-name')
    const got = await username()
    expect(got).toEqual('username-user-name')
  })

  test('returns os.userInfo().username if set and environment variables are not', async () => {
    vi.mocked(osUserInfo).mockReturnValue({username: 'userInfo-username'} as any)

    const got = await username()

    expect(got).toEqual('userInfo-username')
    expect(osUserInfo).toHaveBeenCalled()
    expect(execa).not.toHaveBeenCalled()
  })

  test('falls back to execa if os.userInfo() throws an error', async () => {
    vi.mocked(osUserInfo).mockImplementation(() => {
      throw new Error('userInfo error')
    })
    vi.mocked(execa).mockResolvedValue({stdout: 'id-username'} as any)

    const got = await username('linux')

    expect(got).toEqual('id-username')
    expect(osUserInfo).toHaveBeenCalled()
    expect(execa).toHaveBeenCalled()
  })

  test('on win32 platform, queries whoami and cleans domain prefix', async () => {
    vi.mocked(osUserInfo).mockImplementation(() => {
      throw new Error('userInfo error')
    })
    vi.mocked(execa).mockResolvedValueOnce({stdout: 'MYDOMAIN\\test-win-user'} as any)

    const got = await username('win32')

    expect(got).toEqual('test-win-user')
    expect(execa).toHaveBeenCalledWith('whoami')
  })

  test('on non-win32 platform, queries uid and then resolves it to a name', async () => {
    vi.mocked(osUserInfo).mockImplementation(() => {
      throw new Error('userInfo error')
    })
    vi.mocked(execa)
      .mockResolvedValueOnce({stdout: '1001'} as any)
      .mockResolvedValueOnce({stdout: 'posix-user-name'} as any)

    const got = await username('linux')

    expect(got).toEqual('posix-user-name')
    expect(execa).toHaveBeenCalledWith('id', ['-u'])
    expect(execa).toHaveBeenCalledWith('id', ['-un', '1001'])
  })

  test('on non-win32 platform, falls back to id prefix when resolving uid fails', async () => {
    vi.mocked(osUserInfo).mockImplementation(() => {
      throw new Error('userInfo error')
    })
    vi.mocked(execa)
      .mockResolvedValueOnce({stdout: '1001'} as any)
      .mockRejectedValueOnce(new Error('id -un failed'))

    const got = await username('darwin')

    expect(got).toEqual('no-username-1001')
    expect(execa).toHaveBeenCalledWith('id', ['-u'])
    expect(execa).toHaveBeenCalledWith('id', ['-un', '1001'])
  })

  test('returns null when top-level execa throws an error', async () => {
    vi.mocked(osUserInfo).mockImplementation(() => {
      throw new Error('userInfo error')
    })
    vi.mocked(execa).mockRejectedValueOnce(new Error('whoami failed'))

    const got = await username('win32')

    expect(got).toBeNull()
  })
})
