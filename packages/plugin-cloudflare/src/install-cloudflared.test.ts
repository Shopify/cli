import install, {CURRENT_CLOUDFLARE_VERSION, versionIsGreaterThan} from './install-cloudflared.js'
import * as http from '@shopify/cli-kit/node/http'
import {inTemporaryDirectory, readFile, writeFile, fileExists} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test, vi} from 'vitest'
import {Readable} from 'stream'
import {writeFileSync} from 'fs'
// eslint-disable-next-line no-restricted-imports
import * as childProcess from 'child_process'

vi.mock('@shopify/cli-kit/node/http')

vi.mock('child_process')

describe('install-cloudflare', () => {
  const mockFetch = (ok = true) => {
    vi.mocked(http.fetch).mockResolvedValue({
      ok,
      status: ok ? 200 : 404,
      statusText: ok ? 'OK' : 'Not Found',
      body: Readable.from(['cloudflared content']),
    } as any)
  }

  test('install is ignored if SHOPIFY_CLI_IGNORE_CLOUDFLARED is present', async () => {
    await inTemporaryDirectory(async (_tmpDir) => {
      // Given
      const env = {SHOPIFY_CLI_IGNORE_CLOUDFLARED: 'true'}
      mockFetch()

      // When
      await install(env)

      // Then
      expect(http.fetch).not.toHaveBeenCalled()
    })
  })

  test('downloads the correct binary for macOS x64', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const binPath = joinPath(tmpDir, 'cloudflared')
      const env = {SHOPIFY_CLI_CLOUDFLARED_PATH: binPath}
      mockFetch()
      vi.mocked(childProcess.execFileSync).mockImplementation((command, args, options) => {
        if (command === 'tar') {
          // Simulate tar extracting the file
          const cwd = options?.cwd as string
          writeFileSync(joinPath(cwd, 'cloudflared'), 'extracted binary')
        }
        return Buffer.from('')
      })

      // When
      await install(env, 'darwin', 'x64')

      // Then
      expect(http.fetch).toHaveBeenCalledWith(
        'https://github.com/cloudflare/cloudflared/releases/download/2024.8.2/cloudflared-darwin-amd64.tgz',
        expect.anything(),
        'slow-request',
      )
      await expect(fileExists(binPath)).resolves.toBe(true)
      await expect(readFile(binPath)).resolves.toBe('extracted binary')
    })
  })

  test('downloads the correct binary for macOS arm64', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const binPath = joinPath(tmpDir, 'cloudflared')
      const env = {SHOPIFY_CLI_CLOUDFLARED_PATH: binPath}
      mockFetch()
      vi.mocked(childProcess.execFileSync).mockImplementation((command, args, options) => {
        if (command === 'tar') {
          const cwd = options?.cwd as string
          writeFileSync(joinPath(cwd, 'cloudflared'), 'extracted binary')
        }
        return Buffer.from('')
      })

      // When
      await install(env, 'darwin', 'arm64')

      // Then
      expect(http.fetch).toHaveBeenCalledWith(
        'https://github.com/cloudflare/cloudflared/releases/download/2024.8.2/cloudflared-darwin-arm64.tgz',
        expect.anything(),
        'slow-request',
      )
      await expect(fileExists(binPath)).resolves.toBe(true)
    })
  })

  test.skipIf(process.platform === 'win32')(
    'installMacos is no longer vulnerable to command injection via binTarget',
    async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        // A malicious path that attempts to escape the tar command and execute 'touch exploit'
        const binPath = joinPath(tmpDir, '"; touch exploit; #')
        const env = {SHOPIFY_CLI_CLOUDFLARED_PATH: binPath}
        mockFetch()
        vi.mocked(childProcess.execFileSync).mockImplementation((command, args, options) => {
          if (command === 'tar') {
            const cwd = options?.cwd as string
            writeFileSync(joinPath(cwd, 'cloudflared'), 'extracted binary')
          }
          return Buffer.from('')
        })

        // When
        await install(env, 'darwin', 'x64')

        // Then
        expect(childProcess.execFileSync).toHaveBeenCalledWith(
          'tar',
          expect.arrayContaining(['-xzf', expect.stringContaining('; touch exploit; #')]),
          expect.anything(),
        )
      })
    },
  )

  test('downloads the correct binary for linux', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const binPath = joinPath(tmpDir, 'cloudflared')
      const env = {SHOPIFY_CLI_CLOUDFLARED_PATH: binPath}
      mockFetch()

      // When
      await install(env, 'linux', 'x64')

      // Then
      expect(http.fetch).toHaveBeenCalledWith(
        'https://github.com/cloudflare/cloudflared/releases/download/2024.8.2/cloudflared-linux-amd64',
        expect.anything(),
        'slow-request',
      )
      await expect(fileExists(binPath)).resolves.toBe(true)
      await expect(readFile(binPath)).resolves.toBe('cloudflared content')
    })
  })

  test('downloads the correct binary for windows', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const binPath = joinPath(tmpDir, 'cloudflared.exe')
      const env = {SHOPIFY_CLI_CLOUDFLARED_PATH: binPath}
      mockFetch()

      // When
      await install(env, 'win32', 'x64')

      // Then
      expect(http.fetch).toHaveBeenCalledWith(
        'https://github.com/cloudflare/cloudflared/releases/download/2024.8.2/cloudflared-windows-amd64.exe',
        expect.anything(),
        'slow-request',
      )
      await expect(fileExists(binPath)).resolves.toBe(true)
    })
  })

  test('skips install if bin exists and current version is up to date', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const binPath = joinPath(tmpDir, 'cloudflared')
      await writeFile(binPath, 'existing binary')
      const env = {SHOPIFY_CLI_CLOUDFLARED_PATH: binPath}
      vi.mocked(childProcess.execFileSync).mockReturnValue(
        `cloudflared version ${CURRENT_CLOUDFLARE_VERSION} (built 2023-03-13-1444 UTC)`,
      )
      mockFetch()

      // When
      await install(env, 'linux', 'x64')

      // Then
      expect(http.fetch).not.toHaveBeenCalled()
    })
  })

  test('updates install if bin exists but current version is not up to date', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const binPath = joinPath(tmpDir, 'cloudflared')
      await writeFile(binPath, 'old binary')
      const env = {SHOPIFY_CLI_CLOUDFLARED_PATH: binPath}
      vi.mocked(childProcess.execFileSync).mockReturnValue(`cloudflared version 2000.0.0 (built 2023-03-13-1444 UTC)`)
      mockFetch()

      // When
      await install(env, 'linux', 'x64')

      // Then
      expect(http.fetch).toHaveBeenCalled()
      await expect(readFile(binPath)).resolves.toBe('cloudflared content')
    })
  })

  test('throws an error if the platform is unsupported', async () => {
    await inTemporaryDirectory(async (_tmpDir) => {
      // Given
      const env = {}

      // When
      const res = install(env, 'freebsd', 'x64')

      // Then
      await expect(res).rejects.toThrow('Unsupported system platform: freebsd')
    })
  })

  test('throws an error if the architecture is unsupported', async () => {
    await inTemporaryDirectory(async (_tmpDir) => {
      // Given
      const env = {}

      // When
      const res = install(env, 'darwin', 'mips')

      // Then
      await expect(res).rejects.toThrow('Unsupported system arch: mips')
    })
  })
})

describe('version-compare', () => {
  test('versionIsGreaterThan correctly compares versions', () => {
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
