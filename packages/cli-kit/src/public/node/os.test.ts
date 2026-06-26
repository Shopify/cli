import {platformAndArch, username, _resetUsernameCache} from './os.js'
import {describe, test, expect, vi, beforeEach} from 'vitest'

vi.mock('node:process')

describe('username', () => {
  beforeEach(() => {
    _resetUsernameCache()
  })

  test('memoizes the username', async () => {
    // Given
    const platform = process.platform
    const firstPromise = username(platform)

    // When
    const secondPromise = username(platform)

    // Then
    expect(firstPromise).toBe(secondPromise)
    await expect(firstPromise).resolves.toBeDefined()
  })

  test('returns different promises for different platforms', async () => {
    // Given
    const firstPromise = username('darwin')

    // When
    const secondPromise = username('win32')

    // Then
    expect(firstPromise).not.toBe(secondPromise)
  })

  test('resets the cache', async () => {
    // Given
    const platform = process.platform
    const firstPromise = username(platform)
    _resetUsernameCache()

    // When
    const secondPromise = username(platform)

    // Then
    expect(firstPromise).not.toBe(secondPromise)
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
