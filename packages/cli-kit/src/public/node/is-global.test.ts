import {currentProcessIsGlobal, inferPackageManagerForGlobalCLI, installGlobalCLIPrompt} from './is-global.js'
import {findPathUpSync} from './fs.js'
import {cwd} from './path.js'
import {terminalSupportsPrompting} from './system.js'
import {renderSelectPrompt} from './ui.js'
import {globalCLIVersion} from './version.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {realpathSync} from 'fs'

vi.mock('./system.js')
vi.mock('./ui.js')
vi.mock('which')
vi.mock('./version.js')

// Mock fs.js to make findPathUpSync controllable for getProjectDir.
// find-up v6 runs returned paths through locatePathSync which checks file existence,
// so we need to mock findPathUpSync directly rather than globSync.
vi.mock('./fs.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./fs.js')>()
  return {
    ...actual,
    findPathUpSync: vi.fn((...args: Parameters<typeof actual.findPathUpSync>) => actual.findPathUpSync(...args)),
  }
})

// Mock fs.realpathSync at the module level
// By default, call through to the real implementation for real paths,
// but return the path as-is for fake test paths that don't exist
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  const realRealpathSync = actual.realpathSync
  const {existsSync} = actual
  return {
    ...actual,
    realpathSync: vi.fn((path, options) => {
      // For real paths, use the actual implementation
      // For fake test paths, just return the path as-is
      if (existsSync(String(path))) {
        return realRealpathSync(path, options)
      }
      return String(path)
    }),
  }
})

const globalNPMPath = '/path/to/global/npm'
const globalYarnPath = '/path/to/global/yarn'
const globalPNPMPath = '/path/to/global/pnpm'
const globalHomebrewIntel = '/usr/local/Cellar/shopify-cli/3.89.0/bin/shopify'
const globalHomebrewAppleSilicon = '/opt/homebrew/Cellar/shopify-cli/3.89.0/bin/shopify'
const globalHomebrewLinux = '/home/linuxbrew/.linuxbrew/Cellar/shopify-cli/3.89.0/bin/shopify'
const unknownGlobalPath = '/path/to/global/unknown'
// Must be within the actual workspace so currentProcessIsGlobal recognizes it as local
const localProjectPath = `${cwd()}/node_modules/.bin/shopify`

beforeEach(() => {
  // Mock findPathUpSync so getProjectDir returns a shopify.app.toml at the cwd.
  // This lets currentProcessIsGlobal compare binary paths against the project root.
  vi.mocked(findPathUpSync).mockReturnValue(`${cwd()}/shopify.app.toml`)
})

describe('currentProcessIsGlobal', () => {
  test('returns true if argv point to the global npm path', () => {
    // Given
    const argv = ['node', globalNPMPath, 'shopify']

    // When
    const got = currentProcessIsGlobal(argv)

    // Then
    expect(got).toBeTruthy()
  })

  test('returns false if argv points to a local path', () => {
    // Given
    const argv = ['node', localProjectPath, 'shopify']

    // When
    const got = currentProcessIsGlobal(argv)

    // Then
    expect(got).toBeFalsy()
  })
})

describe('inferPackageManagerForGlobalCLI', () => {
  beforeEach(() => {
    // Reset mock to default behavior (calls through to real implementation)
    vi.mocked(realpathSync).mockClear()
  })

  test('returns yarn if yarn is in path', async () => {
    // Given
    const argv = ['node', globalYarnPath, 'shopify']

    // When
    const got = inferPackageManagerForGlobalCLI(argv)

    // Then
    expect(got).toBe('yarn')
  })

  test('returns pnpm is pnpm is in path', async () => {
    // Given
    const argv = ['node', globalPNPMPath, 'shopify']

    // When
    const got = inferPackageManagerForGlobalCLI(argv)

    // Then
    expect(got).toBe('pnpm')
  })

  test('returns npm if nothing else is in path', async () => {
    // Given
    const argv = ['node', unknownGlobalPath, 'shopify']

    // When
    const got = inferPackageManagerForGlobalCLI(argv)

    // Then
    expect(got).toBe('npm')
  })

  test('returns unknown if current process is not global', async () => {
    // Given
    const argv = ['node', localProjectPath, 'shopify']

    // When
    const got = inferPackageManagerForGlobalCLI(argv)

    // Then
    expect(got).toBe('unknown')
  })

  test('returns homebrew if SHOPIFY_HOMEBREW_FORMULA is set', async () => {
    // Given
    const argv = ['node', globalHomebrewAppleSilicon, 'shopify']
    const env = {SHOPIFY_HOMEBREW_FORMULA: 'shopify-cli'}

    // When
    const got = inferPackageManagerForGlobalCLI(argv, env)

    // Then
    expect(got).toBe('homebrew')
  })

  test('returns homebrew for Intel Mac Cellar path', async () => {
    // Given
    const argv = ['node', globalHomebrewIntel, 'shopify']

    // When
    const got = inferPackageManagerForGlobalCLI(argv)

    // Then
    expect(got).toBe('homebrew')
  })

  test('returns homebrew for Apple Silicon Cellar path', async () => {
    // Given
    const argv = ['node', globalHomebrewAppleSilicon, 'shopify']

    // When
    const got = inferPackageManagerForGlobalCLI(argv)

    // Then
    expect(got).toBe('homebrew')
  })

  test('returns homebrew for Linux Homebrew path', async () => {
    // Given
    const argv = ['node', globalHomebrewLinux, 'shopify']

    // When
    const got = inferPackageManagerForGlobalCLI(argv)

    // Then
    expect(got).toBe('homebrew')
  })

  test('returns homebrew when HOMEBREW_PREFIX matches path', async () => {
    // Given
    const argv = ['node', '/opt/homebrew/bin/shopify', 'shopify']
    const env = {HOMEBREW_PREFIX: '/opt/homebrew'}

    // When
    const got = inferPackageManagerForGlobalCLI(argv, env)

    // Then
    expect(got).toBe('homebrew')
  })

  test('resolves symlinks to detect actual package manager (yarn)', async () => {
    // Given: A symlink in /opt/homebrew/bin pointing to yarn global
    const symlinkPath = '/opt/homebrew/bin/shopify'
    const realYarnPath = '/Users/user/.config/yarn/global/node_modules/.bin/shopify'
    const argv = ['node', symlinkPath, 'shopify']
    const env = {HOMEBREW_PREFIX: '/opt/homebrew'}

    // Mock realpathSync for this specific test to resolve the symlink
    vi.mocked(realpathSync).mockImplementationOnce(() => realYarnPath)

    // When
    const got = inferPackageManagerForGlobalCLI(argv, env)

    // Then: Should detect yarn (from real path), not homebrew (from symlink)
    expect(got).toBe('yarn')
    expect(vi.mocked(realpathSync)).toHaveBeenCalledWith(symlinkPath)
  })

  test('resolves symlinks to detect real homebrew installation', async () => {
    // Given: A symlink in /opt/homebrew/bin pointing to a Cellar path (real Homebrew)
    const symlinkPath = '/opt/homebrew/bin/shopify'
    const realHomebrewPath = '/opt/homebrew/Cellar/shopify-cli/3.89.0/bin/shopify'
    const argv = ['node', symlinkPath, 'shopify']

    // Mock realpathSync for this specific test to resolve the symlink
    vi.mocked(realpathSync).mockImplementationOnce(() => realHomebrewPath)

    // When
    const got = inferPackageManagerForGlobalCLI(argv)

    // Then: Should still detect homebrew from the real Cellar path
    expect(got).toBe('homebrew')
  })

  test('falls back to original path if realpath fails', async () => {
    // Given: A path that realpathSync cannot resolve
    const nonExistentPath = '/opt/homebrew/bin/shopify'
    const argv = ['node', nonExistentPath, 'shopify']
    const env = {HOMEBREW_PREFIX: '/opt/homebrew'}

    // Mock realpathSync for this specific test to throw an error
    vi.mocked(realpathSync).mockImplementationOnce(() => {
      throw new Error('ENOENT: no such file or directory')
    })

    // When
    const got = inferPackageManagerForGlobalCLI(argv, env)

    // Then: Should fall back to checking the original path
    expect(got).toBe('homebrew')
  })
})

describe('installGlobalCLIPrompt', () => {
  test('does not prompt if global CLI is already installed', async () => {
    // Given
    vi.mocked(globalCLIVersion).mockImplementationOnce(() => Promise.resolve('3.78.0'))
    vi.mocked(terminalSupportsPrompting).mockReturnValue(true)

    // When
    const got = await installGlobalCLIPrompt()

    // Then
    expect(got).toEqual({install: false, alreadyInstalled: true})
    expect(renderSelectPrompt).not.toHaveBeenCalled()
  })

  test('returns true if the user installs the global CLI', async () => {
    // Given
    vi.mocked(globalCLIVersion).mockImplementationOnce(() => Promise.resolve(undefined))
    vi.mocked(terminalSupportsPrompting).mockReturnValue(true)
    vi.mocked(renderSelectPrompt).mockImplementationOnce(() => Promise.resolve('yes'))

    // When
    const got = await installGlobalCLIPrompt()

    // Then
    expect(got).toEqual({install: true, alreadyInstalled: false})
  })

  test('returns false if the user does not install the global CLI', async () => {
    // Given
    vi.mocked(globalCLIVersion).mockImplementationOnce(() => Promise.resolve(undefined))
    vi.mocked(terminalSupportsPrompting).mockReturnValue(true)
    vi.mocked(renderSelectPrompt).mockImplementationOnce(() => Promise.resolve('no'))

    // When
    const got = await installGlobalCLIPrompt()

    // Then
    expect(got).toEqual({install: false, alreadyInstalled: false})
  })
})
