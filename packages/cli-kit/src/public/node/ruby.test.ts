import {execCLI2} from './ruby.js'
import {captureOutput} from './system.js'
import * as system from './system.js'
import * as file from './fs.js'
import {beforeAll, describe, expect, it, vi} from 'vitest'

beforeAll(() => {
  vi.mock('./fs.js')
  vi.mock('./system')
})

describe('execCLI', () => {
  it('throws an exception when Ruby is not installed', async () => {
    vi.mocked(file.fileExists).mockResolvedValue(true)
    vi.mocked(captureOutput).mockRejectedValue({})

    await expect(() => execCLI2(['args'])).rejects.toThrowError('Ruby environment not found')
  })

  it('throws an exception when Ruby version requirement is not met', async () => {
    const rubyVersion = '2.2.0'
    vi.mocked(file.fileExists).mockResolvedValue(true)
    vi.mocked(captureOutput).mockResolvedValueOnce(rubyVersion)

    await expect(() => execCLI2(['args'])).rejects.toThrowError(
      `Ruby version \u001b[33m${rubyVersion}\u001b[39m is not supported`,
    )
  })

  it('throws an exception when Bundler is not installed', async () => {
    const rubyVersion = '2.7.5'
    vi.mocked(file.fileExists).mockResolvedValue(true)
    vi.mocked(captureOutput).mockResolvedValueOnce(rubyVersion)
    vi.mocked(captureOutput).mockRejectedValue({})

    await expect(() => execCLI2(['args'])).rejects.toThrowError(`Bundler not found`)
  })

  it('throws an exception when Bundler version requirement is not met', async () => {
    const rubyVersion = '2.7.5'
    const bundlerVersion = '2.2.0'
    vi.mocked(file.fileExists).mockResolvedValue(true)
    vi.mocked(captureOutput).mockResolvedValueOnce(rubyVersion)
    vi.mocked(captureOutput).mockResolvedValueOnce(bundlerVersion)

    await expect(() => execCLI2(['args'])).rejects.toThrowError(
      `Bundler version \u001b[33m${bundlerVersion}\u001b[39m is not supported`,
    )
  })

  it('throws an exception when creating CLI working directory', async () => {
    const rubyVersion = '2.7.5'
    const bundlerVersion = '2.4.0'
    vi.mocked(file.fileExists).mockResolvedValue(true)
    vi.mocked(captureOutput).mockResolvedValueOnce(rubyVersion)
    vi.mocked(captureOutput).mockResolvedValueOnce(bundlerVersion)
    vi.mocked(file.mkdir).mockRejectedValue({message: 'Error'})

    await expect(() => execCLI2(['args'])).rejects.toThrowError('Error')
  })

  it('passes token to the CLI2', async () => {
    // Setup
    const originalEnv = process.env

    // Given
    const execSpy = vi.spyOn(system, 'exec')

    process.env = {...originalEnv, SHOPIFY_CLI_2_0_DIRECTORY: './CLI2'}

    vi.mocked(file.fileExists).mockResolvedValue(true)
    vi.mocked(captureOutput).mockResolvedValueOnce('2.7.5')
    vi.mocked(captureOutput).mockResolvedValueOnce('2.4.0')

    // When
    await execCLI2(['args'], {
      token: 'token_0000_1111_2222_3333',
      directory: './directory',
    })

    // Then
    expect(execSpy).toHaveBeenLastCalledWith('bundle', ['exec', 'shopify', 'args'], {
      stdio: 'inherit',
      cwd: './directory',
      env: {
        ...process.env,
        SHOPIFY_CLI_STOREFRONT_RENDERER_AUTH_TOKEN: undefined,
        SHOPIFY_CLI_ADMIN_AUTH_TOKEN: undefined,
        SHOPIFY_CLI_STORE: undefined,
        SHOPIFY_CLI_AUTH_TOKEN: 'token_0000_1111_2222_3333',
        SHOPIFY_CLI_RUN_AS_SUBPROCESS: 'true',
        BUNDLE_GEMFILE: 'CLI2/Gemfile',
      },
    })

    // Teardown
    process.env = originalEnv
  })

  it('run embbed CLI2 when active', async () => {
    // Setup
    const originalEnv = process.env

    // Given
    const execSpy = vi.spyOn(system, 'exec')

    process.env = {...originalEnv, SHOPIFY_CLI_EMBEDDED_THEME_CLI: '1'}

    vi.mocked(file.fileExists).mockResolvedValue(true)
    vi.mocked(file.findPathUp).mockResolvedValue('/embed/internal')
    vi.mocked(captureOutput).mockResolvedValueOnce('2.7.5')
    vi.mocked(captureOutput).mockResolvedValueOnce('2.4.0')

    // When
    await execCLI2(['args'], {
      token: 'token_0000_1111_2222_3333',
      directory: './directory',
    })

    // Then
    expect(execSpy).toHaveBeenLastCalledWith('/embed/internal/bin/shopify', ['args'], {
      stdio: 'inherit',
      cwd: './directory',
      env: {
        ...process.env,
        SHOPIFY_CLI_STOREFRONT_RENDERER_AUTH_TOKEN: undefined,
        SHOPIFY_CLI_ADMIN_AUTH_TOKEN: undefined,
        SHOPIFY_CLI_STORE: undefined,
        SHOPIFY_CLI_AUTH_TOKEN: 'token_0000_1111_2222_3333',
        SHOPIFY_CLI_RUN_AS_SUBPROCESS: 'true',
        BUNDLE_GEMFILE: '/embed/internal/Gemfile',
      },
    })

    // Teardown
    process.env = originalEnv
  })
})
