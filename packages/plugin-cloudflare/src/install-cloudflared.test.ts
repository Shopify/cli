import install, {CURRENT_CLOUDFLARE_VERSION, versionIsGreaterThan} from './install-cloudflared.js'
import * as fsActions from '@shopify/cli-kit/node/fs'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import util from 'util'
import {WriteStream} from 'fs'
// eslint-disable-next-line no-restricted-imports
import * as childProcess from 'child_process'

global.fetch = vi.fn((aa, bb) => {
  return Promise.resolve({ok: true} as Response)
})

vi.mock('child_process')
vi.mock('stream')

describe('install-cloudflare', () => {
  beforeEach(() => {
    vi.spyOn(util, 'promisify').mockReturnValue(vi.fn().mockReturnValue(Promise.resolve()))
    vi.spyOn(global, 'fetch').mockReturnValue(Promise.resolve({ok: true, body: {pipe: vi.fn()}} as unknown as Response))
    vi.spyOn(fsActions, 'fileExistsSync').mockReturnValueOnce(false)
    vi.spyOn(fsActions, 'mkdirSync').mockImplementation(() => vi.fn())
    vi.spyOn(fsActions, 'unlinkFileSync').mockImplementation(() => vi.fn())
    vi.spyOn(fsActions, 'renameFile').mockImplementation(() => Promise.resolve())
    vi.spyOn(fsActions, 'chmod').mockImplementation(() => Promise.resolve())
    vi.spyOn(fsActions, 'createFileWriteStream').mockReturnValue({pipe: vi.fn()} as unknown as WriteStream)
  })

  test('install is ignored if SHOPIFY_CLI_IGNORE_CLOUDFLARED is present', async () => {
    // Given
    const env = {SHOPIFY_CLI_IGNORE_CLOUDFLARED: 'true'}

    // When
    await install(env)

    // Then
    expect(global.fetch).not.toHaveBeenCalled()
  })

  test('install works when system is mac', async () => {
    // Given
    const env = {}

    // When
    await install(env, 'darwin', 'x64')

    // Then
    // expect(global.fetch).not.toHaveBeenCalled()
    expect(global.fetch).toHaveBeenCalledWith(
      'https://github.com/cloudflare/cloudflared/releases/download/2024.2.1/cloudflared-darwin-amd64.tgz',
      expect.anything(),
    )
  })

  test('install works when system is linux', async () => {
    // Given
    const env = {}

    // When
    await install(env, 'linux', 'x64')

    // Then
    // expect(global.fetch).not.toHaveBeenCalled()
    expect(global.fetch).toHaveBeenCalledWith(
      'https://github.com/cloudflare/cloudflared/releases/download/2024.2.1/cloudflared-linux-amd64',
      expect.anything(),
    )
  })

  test('install works when system is windows', async () => {
    // Given
    const env = {}

    // When
    await install(env, 'win32', 'x64')

    // Then
    expect(global.fetch).toHaveBeenCalledWith(
      'https://github.com/cloudflare/cloudflared/releases/download/2024.2.1/cloudflared-windows-amd64.exe',
      expect.anything(),
    )
  })

  test('install ignored if bin exists but current version is up to date', async () => {
    // Given
    const env = {}
    vi.spyOn(fsActions, 'fileExistsSync').mockReturnValueOnce(true)
    vi.spyOn(childProcess, 'execFileSync').mockReturnValue(
      `cloudflared version ${CURRENT_CLOUDFLARE_VERSION} (built 2023-03-13-1444 UTC)`,
    )

    // When
    await install(env, 'win32', 'x64')

    // Then
    expect(global.fetch).not.toHaveBeenCalled()
  })

  test('install works if bin exists and current version is not up to date', async () => {
    // Given
    const env = {}
    vi.spyOn(fsActions, 'fileExistsSync').mockReturnValueOnce(true)
    vi.spyOn(childProcess, 'execFileSync').mockReturnValue(`cloudflared version 2000.0.0 (built 2023-03-13-1444 UTC)`)

    // When
    await install(env, 'darwin', 'x64')

    // Then
    expect(global.fetch).toHaveBeenCalled()
  })

  test('install fails if unsupported platform', async () => {
    // Given
    const env = {}

    // When
    const res = install(env, 'freebsd', 'x64')

    // Then
    await expect(res).rejects.toThrow('Unsupported system platform: freebsd')
  })

  test('install fails if unsupported arch', async () => {
    // Given
    const env = {}

    // When
    const res = install(env, 'darwin', 'mips')

    // Then
    await expect(res).rejects.toThrow('Unsupported system arch: mips')
  })
})

describe('version-compare', () => {
  test('versionIsGreaterThan', () => {
    expect(versionIsGreaterThan('1.0.0', '0.9.0')).toBe(true)
    expect(versionIsGreaterThan('0.9.0', '1.0.0')).toBe(false)
    expect(versionIsGreaterThan('1.0.0', '1.0.0')).toBe(false)
    expect(versionIsGreaterThan('1.0.0', '1.0.1')).toBe(false)
    expect(versionIsGreaterThan('1.0.1', '1.0.0')).toBe(true)
    expect(versionIsGreaterThan('2', '1.9.9')).toBe(true)
    expect(versionIsGreaterThan('2.9', '1.9.9')).toBe(true)
    expect(versionIsGreaterThan('2.9.9', '1.9.9')).toBe(true)
    expect(versionIsGreaterThan('2.0.0', '3')).toBe(false)
    expect(versionIsGreaterThan('2.0.0', '3.0')).toBe(false)
    expect(versionIsGreaterThan('5', '4')).toBe(true)
    expect(versionIsGreaterThan('4', '5')).toBe(false)
  })
})
