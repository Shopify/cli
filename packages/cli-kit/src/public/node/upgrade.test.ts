import {currentProcessIsGlobal, inferPackageManagerForGlobalCLI} from './is-global.js'
import {checkForCachedNewVersion} from './node-package-manager.js'
import {cliInstallCommand, versionToAutoUpgrade, runCLIUpgrade} from './upgrade.js'
import {exec} from './system.js'
import {mockAndCaptureOutput} from './testing/output.js'
import {vi, describe, test, expect, beforeEach, afterEach} from 'vitest'

vi.mock('./is-global.js')
vi.mock('./node-package-manager.js')
vi.mock('./system.js')

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

  test('returns pnpm add --global for pnpm (v8+ compatible)', () => {
    vi.mocked(currentProcessIsGlobal).mockReturnValue(true)
    vi.mocked(inferPackageManagerForGlobalCLI).mockReturnValue('pnpm')

    const got = cliInstallCommand()

    expect(got).toMatchInlineSnapshot(`"pnpm add --global @shopify/cli@latest"`)
  })
})

afterEach(() => {
  mockAndCaptureOutput().clear()
  vi.unstubAllEnvs()
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

  test('returns undefined when SHOPIFY_CLI_NO_AUTO_UPGRADE is set', () => {
    vi.mocked(checkForCachedNewVersion).mockReturnValue('3.100.0')
    vi.stubEnv('SHOPIFY_CLI_NO_AUTO_UPGRADE', '1')

    const got = versionToAutoUpgrade()

    expect(got).toBeUndefined()
  })

  test('returns version when SHOPIFY_CLI_FORCE_AUTO_UPGRADE is set', () => {
    vi.mocked(checkForCachedNewVersion).mockReturnValue('3.100.0')
    vi.stubEnv('SHOPIFY_CLI_FORCE_AUTO_UPGRADE', '1')

    const got = versionToAutoUpgrade()

    expect(got).toBe('3.100.0')
  })

  test('FORCE_AUTO_UPGRADE overrides NO_AUTO_UPGRADE', () => {
    vi.mocked(checkForCachedNewVersion).mockReturnValue('3.100.0')
    vi.stubEnv('SHOPIFY_CLI_NO_AUTO_UPGRADE', '1')
    vi.stubEnv('SHOPIFY_CLI_FORCE_AUTO_UPGRADE', '1')

    const got = versionToAutoUpgrade()

    expect(got).toBe('3.100.0')
  })
})

describe('runCLIUpgrade', () => {
  test('calls exec with the install command for global npm installs', async () => {
    vi.mocked(currentProcessIsGlobal).mockReturnValue(true)
    vi.mocked(inferPackageManagerForGlobalCLI).mockReturnValue('npm')
    vi.mocked(exec).mockResolvedValue(undefined)

    await runCLIUpgrade()

    expect(exec).toHaveBeenCalledWith('npm', ['install', '-g', '@shopify/cli@latest'], {stdio: 'inherit'})
  })

  test('calls exec with 120s timeout for homebrew installs', async () => {
    vi.mocked(currentProcessIsGlobal).mockReturnValue(true)
    vi.mocked(inferPackageManagerForGlobalCLI).mockReturnValue('homebrew')
    vi.mocked(exec).mockResolvedValue(undefined)

    await runCLIUpgrade()

    expect(exec).toHaveBeenCalledWith(
      'brew',
      ['upgrade', 'shopify-cli'],
      expect.objectContaining({stdio: 'inherit', timeout: 120_000}),
    )
  })

  test('warns and re-throws on homebrew timeout', async () => {
    const outputMock = mockAndCaptureOutput()
    vi.mocked(currentProcessIsGlobal).mockReturnValue(true)
    vi.mocked(inferPackageManagerForGlobalCLI).mockReturnValue('homebrew')

    const timeoutError = Object.assign(new Error('timed out'), {timedOut: true})
    vi.mocked(exec).mockImplementation(async (_cmd, _args, opts) => {
      if (opts?.externalErrorHandler) await opts.externalErrorHandler(timeoutError)
    })

    await expect(runCLIUpgrade()).rejects.toThrow()
    expect(outputMock.warn()).toContain('timed out')
  })
})
