import {execCLI2, MinWdmWindowsVersion, RubyCLIVersion, bundleUserHome} from './ruby.js'
import {captureOutput} from './system.js'
import * as system from './system.js'
import {platformAndArch} from './os.js'
import {joinPath} from './path.js'
import {inTemporaryDirectory, mkdir, findPathUp, touchFile, appendFile, fileExists, readFile} from './fs.js'
import {getEnvironmentVariables} from './environment.js'
import {isSpinEnvironment, spinFqdn} from './context/spin.js'
import {pathConstants} from '../../private/node/constants.js'
import {beforeEach, describe, expect, test, SpyInstance, vi} from 'vitest'

vi.mock('./system')
vi.mock('./environment')
vi.mock('./fs')
vi.mock('./os')
vi.mock('../../private/node/constants.js')
vi.mock('./context/spin.js')

beforeEach(() => {
  vi.mocked(getEnvironmentVariables).mockReturnValue({})
  mockPlatformAndArch({windows: false})
})

describe('execCLI', () => {
  test('throws an exception when Ruby is not installed', async () => {
    vi.mocked(getEnvironmentVariables).mockReturnValue({SHOPIFY_CLI_BUNDLED_THEME_CLI: '1'})
    vi.mocked(captureOutput).mockRejectedValue({})

    await expect(() => execCLI2(['args'])).rejects.toThrowError('Ruby environment not found')
  })

  test('throws an exception when Ruby version requirement is not met', async () => {
    const rubyVersion = '2.2.0'
    vi.mocked(getEnvironmentVariables).mockReturnValue({SHOPIFY_CLI_BUNDLED_THEME_CLI: '1'})
    vi.mocked(captureOutput).mockResolvedValueOnce(rubyVersion)

    await expect(() => execCLI2(['args'])).rejects.toThrowError(
      `Ruby version \u001b[33m${rubyVersion}\u001b[39m is not supported`,
    )
  })

  test('throws an exception when Bundler is not installed', async () => {
    const rubyVersion = '2.7.5'
    vi.mocked(getEnvironmentVariables).mockReturnValue({SHOPIFY_CLI_BUNDLED_THEME_CLI: '1'})
    vi.mocked(captureOutput).mockResolvedValueOnce(rubyVersion)
    vi.mocked(captureOutput).mockRejectedValue({})

    await expect(() => execCLI2(['args'])).rejects.toThrowError(`Bundler not found`)
  })

  test('throws an exception when Bundler version requirement is not met', async () => {
    const rubyVersion = '2.7.5'
    const bundlerVersion = '2.2.0'
    vi.mocked(getEnvironmentVariables).mockReturnValue({SHOPIFY_CLI_BUNDLED_THEME_CLI: '1'})
    vi.mocked(captureOutput).mockResolvedValueOnce(rubyVersion)
    vi.mocked(captureOutput).mockResolvedValueOnce(bundlerVersion)

    await expect(() => execCLI2(['args'])).rejects.toThrowError(
      `Bundler version \u001b[33m${bundlerVersion}\u001b[39m is not supported`,
    )
  })

  test('throws an exception when creating CLI working directory', async () => {
    // Given
    const rubyVersion = '2.7.5'
    const bundlerVersion = '2.4.0'
    vi.mocked(getEnvironmentVariables).mockReturnValue({SHOPIFY_CLI_BUNDLED_THEME_CLI: '1'})
    vi.mocked(captureOutput).mockResolvedValueOnce(rubyVersion)
    vi.mocked(captureOutput).mockResolvedValueOnce(bundlerVersion)
    vi.mocked(mkdir).mockRejectedValue({message: 'Error'})

    // When/Then
    await expect(() => execCLI2(['args'])).rejects.toThrowError('Error')
  })

  test('when run bundled CLI2 in non windows then gemfile content is correct and bundle runs with correct params', async () => {
    await inTemporaryDirectory(async (cli2Directory) => {
      // Given
      const execSpy = mockBundledCLI2(cli2Directory, {windows: false})
      const gemfilePath = joinPath(cli2Directory, 'ruby-cli', RubyCLIVersion, 'Gemfile')

      // When
      await execCLI2(['args'], {
        token: 'token_0000_1111_2222_3333',
        directory: './directory',
      })

      // Then
      validateBundleExec(execSpy, gemfilePath)
      await validateGemFileContent(gemfilePath, {bundled: true, windows: false})
    })
  })

  test('when run bundled CLI2 in windows then gemfile content should be correct and bundle runs with correct params', async () => {
    await inTemporaryDirectory(async (cli2Directory) => {
      // Given
      const execSpy = mockBundledCLI2(cli2Directory, {windows: true})
      const gemfilePath = joinPath(cli2Directory, 'ruby-cli', RubyCLIVersion, 'Gemfile')

      // When
      await execCLI2(['args'], {
        token: 'token_0000_1111_2222_3333',
        directory: './directory',
      })

      // Then
      validateBundleExec(execSpy, gemfilePath)
      await validateGemFileContent(gemfilePath, {bundled: true, windows: true})
    })
  })

  test('when run embedded CLI2 in non windows then gemfile content should be correct and bundle runs with correct params', async () => {
    await inTemporaryDirectory(async (cli2Directory) => {
      // Given
      const execSpy = await mockEmbeddedCLI2(cli2Directory, {windows: false, existingWindowsDependency: false})
      const gemfilePath = joinPath(cli2Directory, 'Gemfile')

      // When
      await execCLI2(['args'], {
        token: 'token_0000_1111_2222_3333',
        directory: './directory',
      })

      // Then
      validateBundleExec(execSpy, gemfilePath, joinPath(cli2Directory, 'bin', 'shopify'))
      await validateGemFileContent(gemfilePath, {bundled: false, windows: false})
    })
  })

  test('when run embedded CLI2 in windows without dependency then gemfile content should be correct and bundle runs with correct params', async () => {
    await inTemporaryDirectory(async (cli2Directory) => {
      // Given
      const execSpy = await mockEmbeddedCLI2(cli2Directory, {windows: true, existingWindowsDependency: false})
      const gemfilePath = joinPath(cli2Directory, 'Gemfile')

      // When
      await execCLI2(['args'], {
        token: 'token_0000_1111_2222_3333',
        directory: './directory',
      })

      // Then
      validateBundleExec(execSpy, gemfilePath, joinPath(cli2Directory, 'bin', 'shopify'))
      await validateGemFileContent(gemfilePath, {bundled: false, windows: true})
    })
  })

  test('when run embedded CLI2 in windows with existing dependency then gemfile content should be correct and bundle runs with correct params', async () => {
    await inTemporaryDirectory(async (cli2Directory) => {
      // Given
      const execSpy = await mockEmbeddedCLI2(cli2Directory, {windows: true, existingWindowsDependency: true})
      const gemfilePath = joinPath(cli2Directory, 'Gemfile')

      // When
      await execCLI2(['args'], {
        token: 'token_0000_1111_2222_3333',
        directory: './directory',
      })

      // Then
      validateBundleExec(execSpy, gemfilePath, joinPath(cli2Directory, 'bin', 'shopify'))
      await validateGemFileContent(gemfilePath, {bundled: false, windows: true})
    })
  })

  test('when run CLI2 in spin then bundle runs with correct params', async () => {
    await inTemporaryDirectory(async (cli2Directory) => {
      // Given
      const fqdn = 'workspace.namespace.eu.spin.dev'
      const execSpy = await mockEmbeddedCLI2(cli2Directory, {windows: true, existingWindowsDependency: true})
      const gemfilePath = joinPath(cli2Directory, 'Gemfile')
      vi.mocked(isSpinEnvironment).mockReturnValue(true)
      vi.mocked(spinFqdn).mockResolvedValue(fqdn)

      // When
      await execCLI2(['args'], {
        token: 'token_0000_1111_2222_3333',
        directory: './directory',
      })

      // Then
      validateBundleExec(execSpy, gemfilePath, joinPath(cli2Directory, 'bin', 'shopify'), fqdn)
      await validateGemFileContent(gemfilePath, {bundled: false, windows: true})
    })
  })

  test('when we run bundler on Windows and there is a PUBLIC env var, we set BUNDLE_USER_HOME', async () => {
    // Given
    mockPlatformAndArch({windows: true})
    vi.stubEnv('PUBLIC', 'root')

    // When
    expect(bundleUserHome()).toEqual(joinPath('root', 'AppData', 'Local', 'shopify-bundler-nodejs', 'Cache'))
    vi.unstubAllEnvs()
  })

  test('when we run bundler on Windows and there is no PUBLIC env var, we dont set BUNDLE_USER_HOME', async () => {
    // Given
    mockPlatformAndArch({windows: true})
    vi.stubEnv('PUBLIC', '')

    // When
    expect(bundleUserHome()).toBeUndefined()
    vi.unstubAllEnvs()
  })

  test('when we run bundler on other OSes, we dont set BUNDLE_USER_HOME', async () => {
    // Given
    mockPlatformAndArch({windows: false})

    // When
    expect(bundleUserHome()).toBeUndefined()
  })
})

function mockBundledCLI2(cli2Directory: string, {windows}: {windows: boolean}) {
  vi.mocked(getEnvironmentVariables).mockReturnValue({SHOPIFY_CLI_BUNDLED_THEME_CLI: '1'})
  vi.mocked(pathConstants.directories.cache.vendor.path).mockReturnValue(cli2Directory)
  mockRubyEnvironment()
  mockPlatformAndArch({windows})
  return vi.spyOn(system, 'exec')
}

async function mockEmbeddedCLI2(
  cli2Directory: string,
  {windows, existingWindowsDependency}: {windows: boolean; existingWindowsDependency: boolean},
) {
  vi.mocked(findPathUp).mockResolvedValue(cli2Directory)
  mockRubyEnvironment()
  mockPlatformAndArch({windows})
  await createGemFile(cli2Directory, existingWindowsDependency)
  return vi.spyOn(system, 'exec')
}

function mockRubyEnvironment() {
  vi.mocked(captureOutput).mockResolvedValueOnce('2.7.5')
  vi.mocked(captureOutput).mockResolvedValueOnce('2.4.0')
}

function mockPlatformAndArch({windows}: {windows: boolean}) {
  if (windows) {
    vi.mocked(platformAndArch).mockReturnValue({platform: 'windows', arch: 'x64'})
  } else {
    vi.mocked(platformAndArch).mockReturnValue({platform: 'darwin', arch: 'x64'})
  }
}

async function createGemFile(cli2Directory: string, existingWindowsDependency: boolean) {
  const gemfilePath = joinPath(cli2Directory, 'Gemfile')
  let content = "source 'https://rubygems.org'\n"
  if (existingWindowsDependency) content = content.concat(`gem 'wdm', '>= ${MinWdmWindowsVersion}'`)
  await touchFile(gemfilePath)
  await appendFile(gemfilePath, content.concat('\n'))
}

function validateBundleExec(execSpy: SpyInstance, gemFilePath: string, execPath = 'shopify', spinFqdn?: string) {
  expect(execSpy).toHaveBeenLastCalledWith('bundle', ['exec', execPath, 'args'], {
    stdio: 'inherit',
    cwd: './directory',
    env: {
      ...process.env,
      SHOPIFY_CLI_STOREFRONT_RENDERER_AUTH_TOKEN: undefined,
      SHOPIFY_CLI_ADMIN_AUTH_TOKEN: undefined,
      SHOPIFY_CLI_STORE: undefined,
      SHOPIFY_CLI_AUTH_TOKEN: 'token_0000_1111_2222_3333',
      SHOPIFY_CLI_RUN_AS_SUBPROCESS: 'true',
      SHOPIFY_CLI_RUBY_BIN: 'ruby',
      BUNDLE_GEMFILE: gemFilePath,
      ...(spinFqdn && {SPIN_FQDN: spinFqdn, SPIN: 1}),
    },
  })
}

async function validateGemFileContent(gemfilePath: string, {bundled, windows}: {bundled: boolean; windows: boolean}) {
  expect(fileExists(gemfilePath)).toBeTruthy()
  const gemContent = await readFile(gemfilePath, {encoding: 'utf8'})
  expect(gemContent).toContain("source 'https://rubygems.org'")
  if (bundled) expect(gemContent).toContain(`gem 'shopify-cli', '${RubyCLIVersion}'`)
  const windowsDepency = `gem 'wdm', '>= ${MinWdmWindowsVersion}'`
  if (windows) {
    expect(gemContent).toContain(windowsDepency)
    const notDuplicated = gemContent.indexOf(windowsDepency) === gemContent.lastIndexOf(windowsDepency)
    expect(notDuplicated).toBeTruthy()
  } else {
    expect(gemContent).not.toContain(windowsDepency)
  }
}
