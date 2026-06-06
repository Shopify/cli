import {platformAndArch, username} from './os.js'
import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest'
import {userInfo} from 'os'

vi.mock('node:process')
vi.mock('os', async (importOriginal) => {
  const original: any = await importOriginal()
  return {
    ...original,
    userInfo: vi.fn(),
  }
})

describe('username', () => {
  beforeEach(() => {
    vi.mocked(userInfo).mockReturnValue({
      username: 'test-user',
      uid: 1,
      gid: 1,
      shell: 'sh',
      homedir: '/home/test-user',
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('returns the username and memoizes it', async () => {
    // Given
    vi.stubEnv('SUDO_USER', 'test-user')

    // When
    const result1 = await username()
    const result2 = await username()

    // Then
    expect(result1).toBe('test-user')
    expect(result2).toBe('test-user')
    expect(username()).toBe(username())
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
