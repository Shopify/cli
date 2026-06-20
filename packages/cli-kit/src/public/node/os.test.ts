import {platformAndArch, username, _resetUsername} from './os.js'
import {describe, test, expect, vi, beforeEach} from 'vitest'
import * as os from 'os'

vi.mock('node:process')
vi.mock('os', async () => {
  const actual: any = await vi.importActual('os')
  return {
    ...actual,
    userInfo: vi.fn(),
  }
})

describe('username', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      SUDO_USER: undefined,
      C9_USER: undefined,
      LOGNAME: undefined,
      USER: undefined,
      LNAME: undefined,
      USERNAME: undefined,
    }
    _resetUsername()
    vi.mocked(os.userInfo).mockReturnValue({
      username: 'testuser',
      uid: 1,
      gid: 1,
      shell: 'shell',
      homedir: 'home',
    } as any)
  })

  test('memoizes the username', async () => {
    // When
    const firstCall = username()
    const secondCall = username()

    // Then
    await expect(firstCall).resolves.toEqual('testuser')
    await expect(secondCall).resolves.toEqual('testuser')
    expect(firstCall).toBe(secondCall)
    expect(os.userInfo).toHaveBeenCalledTimes(1)
  })

  test('does not memoize if platform is different', async () => {
    // When
    const differentPlatform = process.platform === 'win32' ? 'linux' : 'win32'
    const firstCall = username(differentPlatform)
    const secondCall = username(differentPlatform)

    // Then
    await expect(firstCall).resolves.toEqual('testuser')
    await expect(secondCall).resolves.toEqual('testuser')
    expect(firstCall).not.toBe(secondCall)
    expect(os.userInfo).toHaveBeenCalledTimes(2)
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
