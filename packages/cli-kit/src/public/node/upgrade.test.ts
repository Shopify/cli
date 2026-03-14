import {currentProcessIsGlobal, inferPackageManagerForGlobalCLI} from './is-global.js'
import {checkForCachedNewVersion} from './node-package-manager.js'
import {cliInstallCommand, versionToAutoUpgrade, runCLIUpgrade} from './upgrade.js'
import {exec} from './system.js'
import {vi, describe, test, expect, beforeEach} from 'vitest'

vi.mock('./is-global.js')
vi.mock('./node-package-manager.js')
vi.mock('./system.js')
vi.mock('../../private/node/conf-store.js')

describe('cliInstallCommand', () => {
  test('returns undefined when process is not global', () => {
    vi.mocked(currentProcessIsGlobal).mockReturnValue(false)
    vi.mocked(inferPackageManagerForGlobalCLI).mockReturnValue('unknown')

    const got = cliInstallCommand()

    expect(got).toBeUndefined()
  })

  test('returns brew upgrade command for homebrew', () => {
    vi.mocked(currentProcessIsGlobal).mockReturnValue(true)
    vi.mocked(inferPackageManagerForGlobalCLI).mockReturnValue('homebrew')

    const got = cliInstallCommand()

    expect(got).toMatchInlineSnapshot(`"brew upgrade shopify-cli"`)
  })

  test('returns yarn global add for yarn', () => {
    vi.mocked(currentProcessIsGlobal).mockReturnValue(true)
    vi.mocked(inferPackageManagerForGlobalCLI).mockReturnValue('yarn')

    const got = cliInstallCommand()

    expect(got).toMatchInlineSnapshot(`"yarn global add @shopify/cli@latest"`)
  })

  test('returns npm install -g for npm', () => {
    vi.mocked(currentProcessIsGlobal).mockReturnValue(true)
    vi.mocked(inferPackageManagerForGlobalCLI).mockReturnValue('npm')

    const got = cliInstallCommand()

    expect(got).toMatchInlineSnapshot(`"npm install -g @shopify/cli@latest"`)
  })

  test('returns pnpm add -g for pnpm', () => {
    vi.mocked(currentProcessIsGlobal).mockReturnValue(true)
    vi.mocked(inferPackageManagerForGlobalCLI).mockReturnValue('pnpm')

    const got = cliInstallCommand()

    expect(got).toMatchInlineSnapshot(`"pnpm add -g @shopify/cli@latest"`)
  })
})

describe('versionToAutoUpgrade', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  test('returns undefined when no newer version is cached', () => {
    vi.mocked(checkForCachedNewVersion).mockReturnValue(undefined)

    const got = versionToAutoUpgrade()

    expect(got).toBeUndefined()
  })

  test('returns version when SHOPIFY_CLI_FORCE_AUTO_UPGRADE is set', () => {
    vi.mocked(checkForCachedNewVersion).mockReturnValue('3.100.0')
    vi.stubEnv('SHOPIFY_CLI_FORCE_AUTO_UPGRADE', '1')

    const got = versionToAutoUpgrade()

    expect(got).toBe('3.100.0')
  })

  test('returns undefined when auto-upgrade is not enabled', async () => {
    vi.mocked(checkForCachedNewVersion).mockReturnValue('3.100.0')

    const {getAutoUpgradeEnabled} = await import('../../private/node/conf-store.js')
    vi.mocked(getAutoUpgradeEnabled).mockReturnValue(false)

    const got = versionToAutoUpgrade()

    expect(got).toBeUndefined()
  })
})

describe('runCLIUpgrade', () => {
  test('calls exec with the install command for global installs', async () => {
    vi.mocked(currentProcessIsGlobal).mockReturnValue(true)
    vi.mocked(inferPackageManagerForGlobalCLI).mockReturnValue('npm')
    vi.mocked(exec).mockResolvedValue(undefined)

    await runCLIUpgrade()

    expect(exec).toHaveBeenCalledWith('npm', ['install', '-g', '@shopify/cli@latest'], {stdio: 'inherit'})
  })
})
