import {execCLI2, RubyCLIVersion} from './ruby.js'
import {captureOutput} from './system.js'
import * as system from './system.js'
import * as file from './fs.js'
import * as local from './context/local.js'
import {platformAndArch} from './os.js'
import {joinPath} from './path.js'
import {pathConstants} from '../../private/node/constants.js'
import {describe, expect, it, SpyInstance, vi} from 'vitest'

vi.mock('./system')
vi.mock('./os')

describe('execCLI', () => {
  it('throws an exception when Ruby is not installed', async () => {
    vi.spyOn(local, 'isShopify').mockResolvedValue(false)
    vi.mocked(captureOutput).mockRejectedValue({})

    await expect(() => execCLI2(['args'])).rejects.toThrowError('Ruby environment not found')
  })

  it('throws an exception when Ruby version requirement is not met', async () => {
    const rubyVersion = '2.2.0'
    vi.spyOn(local, 'isShopify').mockResolvedValue(false)
    vi.mocked(captureOutput).mockResolvedValueOnce(rubyVersion)

    await expect(() => execCLI2(['args'])).rejects.toThrowError(
      `Ruby version \u001b[33m${rubyVersion}\u001b[39m is not supported`,
    )
  })

  it('throws an exception when Bundler is not installed', async () => {
    const rubyVersion = '2.7.5'
    vi.spyOn(local, 'isShopify').mockResolvedValue(false)
    vi.mocked(captureOutput).mockResolvedValueOnce(rubyVersion)
    vi.mocked(captureOutput).mockRejectedValue({})

    await expect(() => execCLI2(['args'])).rejects.toThrowError(`Bundler not found`)
  })

  it('throws an exception when Bundler version requirement is not met', async () => {
    const rubyVersion = '2.7.5'
    const bundlerVersion = '2.2.0'
    vi.spyOn(local, 'isShopify').mockResolvedValue(false)
    vi.mocked(captureOutput).mockResolvedValueOnce(rubyVersion)
    vi.mocked(captureOutput).mockResolvedValueOnce(bundlerVersion)

    await expect(() => execCLI2(['args'])).rejects.toThrowError(
      `Bundler version \u001b[33m${bundlerVersion}\u001b[39m is not supported`,
    )
  })

  it('throws an exception when creating CLI working directory', async () => {
    // Given
    const rubyVersion = '2.7.5'
    const bundlerVersion = '2.4.0'
    vi.spyOn(local, 'isShopify').mockResolvedValue(false)
    vi.mocked(captureOutput).mockResolvedValueOnce(rubyVersion)
    vi.mocked(captureOutput).mockResolvedValueOnce(bundlerVersion)
    vi.spyOn(file, 'mkdir').mockRejectedValue({message: 'Error'})

    // When/Then
    await expect(() => execCLI2(['args'])).rejects.toThrowError('Error')
  })

  it('when run bundled CLI2 in non windows then gemfile content is correct and bundle runs with correct params', async () => {
    await file.inTemporaryDirectory(async (cli2Directory) => {
      // Given
      const execSpy = mockBundledCLI2(cli2Directory, {windows: false})
      const gemfilePath = joinPath(cli2Directory, 'ruby-cli', RubyCLIVersion, 'Gemfile')

      // When
      await execCLI2(['args'], {
        token: 'token_0000_1111_2222_3333',
        directory: './directory',
      })

      // Then
      validateBudleExec(execSpy, gemfilePath)
      await validateGemFileContent(gemfilePath, {bundled: true, windows: false})
    })
  })

  it('when run bundled CLI2 in windows then gemfile content should be correct and bundle runs with correct params', async () => {
    await file.inTemporaryDirectory(async (cli2Directory) => {
      // Given
      const execSpy = mockBundledCLI2(cli2Directory, {windows: true})
      const gemfilePath = joinPath(cli2Directory, 'ruby-cli', RubyCLIVersion, 'Gemfile')

      // When
      await execCLI2(['args'], {
        token: 'token_0000_1111_2222_3333',
        directory: './directory',
      })

      // Then
      validateBudleExec(execSpy, gemfilePath)
      await validateGemFileContent(gemfilePath, {bundled: true, windows: true})
    })
  })

  it('when run embedded CLI2 in non windows then gemfile content should be correct and bundle runs with correct params', async () => {
    await file.inTemporaryDirectory(async (cli2Directory) => {
      // Given
      const execSpy = await mockEmbeddedCLI2(cli2Directory, {windows: false, existingWindowsDependency: false})
      const gemfilePath = joinPath(cli2Directory, 'Gemfile')

      // When
      await execCLI2(['args'], {
        token: 'token_0000_1111_2222_3333',
        directory: './directory',
      })

      // Then
      validateBudleExec(execSpy, gemfilePath, joinPath(cli2Directory, 'bin', 'shopify'))
      await validateGemFileContent(gemfilePath, {bundled: false, windows: false})
    })
  })

  it('when run embedded CLI2 in windows without dependency then gemfile content should be correct and bundle runs with correct params', async () => {
    await file.inTemporaryDirectory(async (cli2Directory) => {
      // Given
      const execSpy = await mockEmbeddedCLI2(cli2Directory, {windows: true, existingWindowsDependency: false})
      const gemfilePath = joinPath(cli2Directory, 'Gemfile')

      // When
      await execCLI2(['args'], {
        token: 'token_0000_1111_2222_3333',
        directory: './directory',
      })

      // Then
      validateBudleExec(execSpy, gemfilePath, joinPath(cli2Directory, 'bin', 'shopify'))
      await validateGemFileContent(gemfilePath, {bundled: false, windows: true})
    })
  })

  it('when run embedded CLI2 in windows with existing dependency then gemfile content should be correct and bundle runs with correct params', async () => {
    await file.inTemporaryDirectory(async (cli2Directory) => {
      // Given
      const existingWindowsDependency = true
      const execSpy = await mockEmbeddedCLI2(cli2Directory, {windows: true, existingWindowsDependency: true})
      const gemfilePath = joinPath(cli2Directory, 'Gemfile')

      // When
      await execCLI2(['args'], {
        token: 'token_0000_1111_2222_3333',
        directory: './directory',
      })

      // Then
      validateBudleExec(execSpy, gemfilePath, joinPath(cli2Directory, 'bin', 'shopify'))
      await validateGemFileContent(gemfilePath, {bundled: false, windows: true})
    })
  })
})

function mockBundledCLI2(cli2Directory: string, {windows}: {windows: boolean}) {
  vi.spyOn(local, 'isShopify').mockResolvedValue(false)
  vi.spyOn(pathConstants.directories.cache.vendor, 'path').mockReturnValue(cli2Directory)
  mockRubyEnvironment()
  mockPlatformAndArch({windows})
  return vi.spyOn(system, 'exec')
}

async function mockEmbeddedCLI2(
  cli2Directory: string,
  {windows, existingWindowsDependency}: {windows: boolean; existingWindowsDependency: boolean},
) {
  vi.spyOn(local, 'isShopify').mockResolvedValue(true)
  vi.spyOn(file, 'findPathUp').mockResolvedValue(cli2Directory)
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
  if (existingWindowsDependency) content = content.concat("gem 'wdm', '>= 0.1.0'")
  await file.touchFile(gemfilePath)
  await file.appendFile(gemfilePath, content.concat('\n'))
}

function validateBudleExec(execSpy: SpyInstance, gemFilePath: string, execPath = 'shopify') {
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
      BUNDLE_GEMFILE: gemFilePath,
    },
  })
}

async function validateGemFileContent(gemfilePath: string, {bundled, windows}: {bundled: boolean; windows: boolean}) {
  expect(file.fileExists(gemfilePath)).toBeTruthy()
  const gemContent = await file.readFile(gemfilePath, {encoding: 'utf8'})
  expect(gemContent).toContain("source 'https://rubygems.org'")
  if (bundled) expect(gemContent).toContain(`gem 'shopify-cli', '${RubyCLIVersion}'`)
  const windowsDepency = "gem 'wdm', '>= 0.1.0'"
  if (windows) {
    expect(gemContent).toContain(windowsDepency)
    const notDuplicated = gemContent.indexOf(windowsDepency) === gemContent.lastIndexOf(windowsDepency)
    expect(notDuplicated).toBeTruthy()
  } else {
    expect(gemContent).not.toContain(windowsDepency)
  }
}
