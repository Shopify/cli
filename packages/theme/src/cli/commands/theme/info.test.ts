import Info from './info.js'
import {fetchThemeInfo, getThemeEnvironmentInfo} from '../../services/info.js'
import {themeInfoJsonOutputSchema} from '../../services/info/types.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {Config} from '@oclif/core'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {renderInfo} from '@shopify/cli-kit/node/ui'
import {readFileSync} from 'node:fs'

vi.mock('../../services/info.js')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/ui')

const CommandConfig = new Config({root: __dirname})

const session = {
  token: 'test-token',
  storeFqdn: 'my-shop.myshopify.com',
}

const themeResult = {
  theme: {
    id: 123,
    name: 'my theme',
    role: 'live',
    shop: 'my-shop.myshopify.com',
    preview_url: 'https://my-shop.myshopify.com/preview',
    editor_url: 'https://my-shop.myshopify.com/editor',
  },
}

const environmentResult = {
  store: 'my-shop.myshopify.com',
  development_theme_id: null,
  cli_version: '3.91.0',
  os: 'darwin-arm64',
  shell: '/bin/zsh',
  node_version: 'v24.15.0',
}

function restoreUnitTestEnvironment(value: string | undefined): void {
  process.env.SHOPIFY_UNIT_TEST = value
}

function captureStandardStreams() {
  const stdout: string[] = []
  const stderr: string[] = []

  const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    stdout.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'))
    return true
  }) as typeof process.stdout.write)
  const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    stderr.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'))
    return true
  }) as typeof process.stderr.write)

  return {
    stdout: () => stdout.join(''),
    stderr: () => stderr.join(''),
    restore: () => {
      stdoutSpy.mockRestore()
      stderrSpy.mockRestore()
    },
  }
}

async function run(argv: string[]) {
  await CommandConfig.load()
  vi.mocked(ensureAuthenticatedThemes).mockResolvedValue(session)
  const info = new Info(['--store=my-shop.myshopify.com', '--password=test-password', ...argv], CommandConfig)
  await info.run()
}

describe('Info', () => {
  beforeEach(() => {
    mockAndCaptureOutput().clear()
  })

  describe('when theme or development flag is provided', () => {
    test('outputs JSON when --json flag is passed', async () => {
      vi.mocked(fetchThemeInfo).mockResolvedValue(themeResult)

      await run(['--theme', '123', '--json'])

      expect(fetchThemeInfo).toHaveBeenCalled()
      expect(JSON.parse(mockAndCaptureOutput().output())).toEqual(themeResult)
      expect(renderInfo).not.toHaveBeenCalled()
    })

    test('renders formatted info when no --json flag is passed', async () => {
      vi.mocked(fetchThemeInfo).mockResolvedValue(themeResult)

      await run(['--theme', '123'])

      expect(fetchThemeInfo).toHaveBeenCalled()
      expect(renderInfo).toHaveBeenCalled()
      expect(mockAndCaptureOutput().output()).toBe('')
    })

    test('throws an error when theme is not found without rendering a result', async () => {
      vi.mocked(fetchThemeInfo).mockResolvedValue(undefined)

      await expect(run(['--theme', '999'])).rejects.toThrow('Theme not found!')
      expect(renderInfo).not.toHaveBeenCalled()
      expect(mockAndCaptureOutput().output()).toBe('')
    })
  })

  describe('when no theme or development flag is provided', () => {
    test('outputs JSON when --json flag is passed', async () => {
      vi.mocked(getThemeEnvironmentInfo).mockReturnValue({result: environmentResult, developmentTheme: undefined})

      await run(['--json'])

      expect(getThemeEnvironmentInfo).toHaveBeenCalledWith({cliVersion: expect.any(String)})
      expect(JSON.parse(mockAndCaptureOutput().output())).toEqual(environmentResult)
      expect(renderInfo).not.toHaveBeenCalled()
    })

    test('renders info when no --json flag is passed', async () => {
      vi.mocked(getThemeEnvironmentInfo).mockReturnValue({result: environmentResult, developmentTheme: undefined})

      await run([])

      expect(getThemeEnvironmentInfo).toHaveBeenCalledWith({cliVersion: expect.any(String)})
      expect(renderInfo).toHaveBeenCalled()
      expect(mockAndCaptureOutput().output()).toBe('')
    })
  })

  test('defines the JSON output schema', () => {
    expect(Info.jsonOutputSchema).toBe(themeInfoJsonOutputSchema)
  })

  test('includes the JSON output schema in the help description', () => {
    expect(Info.description).toContain('ThemeInfoResult')
    expect(Info.description).toContain('--json-schema')
  })

  test('is removed from the JSON legacy exemption list', () => {
    const legacyCommandPaths = readFileSync(
      new URL('../../../../../eslint-plugin-cli/rules/json-output-legacy-command-paths.js', import.meta.url),
      'utf8',
    )

    expect(legacyCommandPaths).not.toContain("'packages/theme/src/cli/commands/theme/info.ts'")
  })

  test('writes the selected theme JSON document to stdout without text on stderr', async () => {
    const originalUnitTestEnv = process.env.SHOPIFY_UNIT_TEST
    process.env.SHOPIFY_UNIT_TEST = 'false'
    vi.resetModules()
    const streams = captureStandardStreams()

    try {
      const {default: StreamInfo} = await import('./info.js')
      const {fetchThemeInfo} = await import('../../services/info.js')
      const {ensureAuthenticatedThemes} = await import('@shopify/cli-kit/node/session')
      const {Config} = await import('@oclif/core')
      const streamConfig = new Config({root: __dirname})
      await streamConfig.load()
      vi.mocked(ensureAuthenticatedThemes).mockResolvedValue(session)
      vi.mocked(fetchThemeInfo).mockResolvedValue(themeResult)

      await new StreamInfo(
        ['--store=my-shop.myshopify.com', '--password=test-password', '--theme', '123', '--json'],
        streamConfig,
      ).run()
    } finally {
      streams.restore()
      restoreUnitTestEnvironment(originalUnitTestEnv)
    }

    expect(JSON.parse(streams.stdout())).toEqual(themeResult)
    expect(streams.stderr()).toBe('')
  })

  test('writes the environment JSON document to stdout without text on stderr', async () => {
    const originalUnitTestEnv = process.env.SHOPIFY_UNIT_TEST
    process.env.SHOPIFY_UNIT_TEST = 'false'
    vi.resetModules()
    const streams = captureStandardStreams()

    try {
      const {default: StreamInfo} = await import('./info.js')
      const {getThemeEnvironmentInfo} = await import('../../services/info.js')
      const {ensureAuthenticatedThemes} = await import('@shopify/cli-kit/node/session')
      const {Config} = await import('@oclif/core')
      const streamConfig = new Config({root: __dirname})
      await streamConfig.load()
      vi.mocked(ensureAuthenticatedThemes).mockResolvedValue(session)
      vi.mocked(getThemeEnvironmentInfo).mockReturnValue({result: environmentResult, developmentTheme: undefined})

      await new StreamInfo(['--store=my-shop.myshopify.com', '--password=test-password', '--json'], streamConfig).run()
    } finally {
      streams.restore()
      restoreUnitTestEnvironment(originalUnitTestEnv)
    }

    expect(JSON.parse(streams.stdout())).toEqual(environmentResult)
    expect(streams.stderr()).toBe('')
  })
})
