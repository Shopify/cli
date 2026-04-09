import {isDevelopment} from './context/local.js'
import {currentProcessIsGlobal, inferPackageManagerForGlobalCLI} from './is-global.js'
import {checkForCachedNewVersion, packageManagerFromUserAgent, PackageManager} from './node-package-manager.js'
import {exec, isCI} from './system.js'
import {cliInstallCommand, getOutputUpdateCLIReminder, runCLIUpgrade, versionToAutoUpgrade} from './upgrade.js'
import {isPreReleaseVersion} from './version.js'
import {getAutoUpgradeEnabled} from '../../private/node/conf-store.js'
import {vi, describe, test, expect, beforeEach} from 'vitest'

vi.mock('./context/local.js')
vi.mock('./is-global.js')
vi.mock('./node-package-manager.js')
vi.mock('./system.js')
vi.mock('../../private/node/conf-store.js')
vi.mock('./version.js', async (importOriginal) => {
  const actual: any = await importOriginal()
  return {
    ...actual,
    isPreReleaseVersion: vi.fn(() => false),
  }
})

describe('cliInstallCommand', () => {
  beforeEach(() => {
    // Mock isDevelopment to return false by default (not in CLI development mode)
    vi.mocked(isDevelopment).mockReturnValue(false)
  })

  test('says to install globally via npm if the current process is globally installed and no package manager is provided', () => {
    // Given
    vi.mocked(currentProcessIsGlobal).mockReturnValue(true)
    vi.mocked(inferPackageManagerForGlobalCLI).mockReturnValue('npm')

    // When
    const got = cliInstallCommand()

    // Then
    expect(got).toMatchInlineSnapshot(`
      "npm install -g @shopify/cli@latest"
    `)
  })

  test('says to install globally via yarn if the current process is globally installed and yarn is the global package manager', () => {
    // Given
    vi.mocked(currentProcessIsGlobal).mockReturnValue(true)
    vi.mocked(packageManagerFromUserAgent).mockReturnValue('unknown')
    vi.mocked(inferPackageManagerForGlobalCLI).mockReturnValue('yarn')

    // When
    const got = cliInstallCommand()

    // Then
    expect(got).toMatchInlineSnapshot(`
      "yarn global add @shopify/cli@latest"
    `)
  })

  test('says to install globally via npm if the current process is globally installed and npm is the global package manager', () => {
    // Given
    vi.mocked(currentProcessIsGlobal).mockReturnValue(true)
    vi.mocked(packageManagerFromUserAgent).mockReturnValue('unknown')
    vi.mocked(inferPackageManagerForGlobalCLI).mockReturnValue('npm')

    // When
    const got = cliInstallCommand()

    // Then
    expect(got).toMatchInlineSnapshot(`
      "npm install -g @shopify/cli@latest"
    `)
  })

  test('says to install globally via pnpm if the current process is globally installed and pnpm is the global package manager', () => {
    // Given
    vi.mocked(currentProcessIsGlobal).mockReturnValue(true)
    vi.mocked(packageManagerFromUserAgent).mockReturnValue('unknown')
    vi.mocked(inferPackageManagerForGlobalCLI).mockReturnValue('pnpm')

    // When
    const got = cliInstallCommand()

    // Then
    expect(got).toMatchInlineSnapshot(`
      "pnpm add -g @shopify/cli@latest"
    `)
  })

  test('returns undefined if the current process is locally installed', () => {
    // Given
    vi.mocked(currentProcessIsGlobal).mockReturnValue(false)

    // When
    const got = cliInstallCommand()

    // Then
    expect(got).toBeUndefined()
  })
})
describe('getOutputUpdateCLIReminder', () => {
  test('returns a basic upgrade message for a minor version bump', () => {
    vi.mocked(inferPackageManagerForGlobalCLI).mockReturnValue('homebrew')

    const message = getOutputUpdateCLIReminder('3.91.0')

    expect(message).toContain('3.91.0')
    expect(message).toContain('brew upgrade shopify-cli')
    expect(message).not.toContain('major version')
  })

  test('appends the GitHub release URL for a major version bump', () => {
    vi.mocked(inferPackageManagerForGlobalCLI).mockReturnValue('homebrew')

    const message = getOutputUpdateCLIReminder('4.0.0', true)

    expect(message).toContain('4.0.0')
    expect(message).toContain('brew upgrade shopify-cli')
    expect(message).toContain('major version')
    expect(message).toContain('https://github.com/Shopify/cli/releases/tag/v4.0.0')
  })

  test('does not append the release URL for a minor version bump even when isMajor is false', () => {
    vi.mocked(inferPackageManagerForGlobalCLI).mockReturnValue('npm')

    const message = getOutputUpdateCLIReminder('3.91.0', false)

    expect(message).not.toContain('major version')
    expect(message).not.toContain('releases/tag')
  })
})

describe('runCLIUpgrade', () => {
  beforeEach(() => {
    // Mock isDevelopment to return false by default (not in CLI development mode)
    vi.mocked(isDevelopment).mockReturnValue(false)
  })

  test('runs the install command via exec for a global npm install', async () => {
    // Given
    vi.mocked(currentProcessIsGlobal).mockReturnValue(true)
    vi.mocked(inferPackageManagerForGlobalCLI).mockReturnValue('npm')
    vi.mocked(exec).mockResolvedValue()

    // When
    await runCLIUpgrade()

    // Then
    expect(exec).toHaveBeenCalledWith('npm', ['install', '-g', '@shopify/cli@latest'], {stdio: 'inherit'})
  })

  test('runs the install command via exec for a global yarn install', async () => {
    // Given
    vi.mocked(currentProcessIsGlobal).mockReturnValue(true)
    vi.mocked(inferPackageManagerForGlobalCLI).mockReturnValue('yarn')
    vi.mocked(exec).mockResolvedValue()

    // When
    await runCLIUpgrade()

    // Then
    expect(exec).toHaveBeenCalledWith('yarn', ['global', 'add', '@shopify/cli@latest'], {stdio: 'inherit'})
  })

  test('runs the install command via exec for a global homebrew install', async () => {
    // Given
    vi.mocked(currentProcessIsGlobal).mockReturnValue(true)
    vi.mocked(inferPackageManagerForGlobalCLI).mockReturnValue('homebrew')
    vi.mocked(exec).mockResolvedValue()

    // When
    await runCLIUpgrade()

    // Then
    expect(exec).toHaveBeenCalledWith('brew', ['upgrade', 'shopify-cli'], {stdio: 'inherit'})
  })

  test('throws an error when cliInstallCommand returns undefined', async () => {
    // Given
    vi.mocked(currentProcessIsGlobal).mockReturnValue(true)
    // 'unknown' is returned by inferPackageManagerForGlobalCLI for local installs
    vi.mocked(inferPackageManagerForGlobalCLI).mockReturnValue('unknown' as PackageManager)

    // When/Then
    await expect(runCLIUpgrade()).rejects.toThrow('Could not determine the package manager')
  })

  test('does nothing when running in development mode for local install (SHOPIFY_ENV=development)', async () => {
    // Given
    vi.mocked(currentProcessIsGlobal).mockReturnValue(false)
    vi.mocked(isDevelopment).mockReturnValue(true)

    // When
    await runCLIUpgrade()

    // Then
    expect(exec).not.toHaveBeenCalled()
  })
})

describe('versionToAutoUpgrade', () => {
  test('returns the newer version for a minor bump when auto-upgrade is enabled', () => {
    vi.mocked(checkForCachedNewVersion).mockReturnValue('3.91.0')
    vi.mocked(isCI).mockReturnValue(false)
    vi.mocked(getAutoUpgradeEnabled).mockReturnValue(true)
    expect(versionToAutoUpgrade()).toBe('3.91.0')
  })

  test('returns the newer version for a patch bump when auto-upgrade is enabled', () => {
    vi.mocked(checkForCachedNewVersion).mockReturnValue('3.90.1')
    vi.mocked(isCI).mockReturnValue(false)
    vi.mocked(getAutoUpgradeEnabled).mockReturnValue(true)
    expect(versionToAutoUpgrade()).toBe('3.90.1')
  })

  test('returns undefined when no cached newer version exists', () => {
    vi.mocked(checkForCachedNewVersion).mockReturnValue(undefined)
    expect(versionToAutoUpgrade()).toBeUndefined()
  })

  test('returns undefined when running in CI', () => {
    vi.mocked(checkForCachedNewVersion).mockReturnValue('3.91.0')
    vi.mocked(isCI).mockReturnValue(true)
    vi.mocked(getAutoUpgradeEnabled).mockReturnValue(true)
    expect(versionToAutoUpgrade()).toBeUndefined()
  })

  test('returns undefined when auto-upgrade is not enabled', () => {
    vi.mocked(checkForCachedNewVersion).mockReturnValue('3.91.0')
    vi.mocked(isCI).mockReturnValue(false)
    vi.mocked(getAutoUpgradeEnabled).mockReturnValue(false)
    expect(versionToAutoUpgrade()).toBeUndefined()
  })

  test('returns undefined when auto-upgrade preference has never been set', () => {
    vi.mocked(checkForCachedNewVersion).mockReturnValue('3.91.0')
    vi.mocked(isCI).mockReturnValue(false)
    vi.mocked(getAutoUpgradeEnabled).mockReturnValue(undefined)
    expect(versionToAutoUpgrade()).toBeUndefined()
  })

  test('returns the newer version for a major version change when auto-upgrade is enabled', () => {
    vi.mocked(checkForCachedNewVersion).mockReturnValue('4.0.0')
    vi.mocked(isCI).mockReturnValue(false)
    vi.mocked(getAutoUpgradeEnabled).mockReturnValue(true)
    expect(versionToAutoUpgrade()).toEqual('4.0.0')
  })

  test('returns undefined for a pre-release (nightly/snapshot) version', () => {
    vi.mocked(checkForCachedNewVersion).mockReturnValue('3.91.0')
    vi.mocked(isCI).mockReturnValue(false)
    vi.mocked(getAutoUpgradeEnabled).mockReturnValue(true)
    vi.mocked(isPreReleaseVersion).mockReturnValue(true)
    expect(versionToAutoUpgrade()).toBeUndefined()
    vi.mocked(isPreReleaseVersion).mockReturnValue(false)
  })
})
