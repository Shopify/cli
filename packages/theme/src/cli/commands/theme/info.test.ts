import Info from './info.js'
import {fetchThemeInfo, getThemeEnvironmentInfo} from '../../services/info.js'
import {themeInfoJsonOutputSchema} from '../../services/info/types.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {Config} from '@oclif/core'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {renderConcurrent, renderError, renderInfo} from '@shopify/cli-kit/node/ui'
import {loadEnvironment} from '@shopify/cli-kit/node/environments'
import {recordTiming} from '@shopify/cli-kit/node/analytics'
import {readFileSync} from 'node:fs'

import type {Writable} from 'stream'

vi.mock('../../services/info.js')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/environments')
vi.mock('@shopify/cli-kit/node/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/analytics')>()
  return {
    ...actual,
    recordTiming: vi.fn(),
    recordEvent: vi.fn(),
    compileData: vi.fn(() => ({timings: {}, errors: {}, retries: {}, events: {}})),
  }
})

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

async function runMultiEnvironment(argv: string[]) {
  await CommandConfig.load()
  vi.mocked(ensureAuthenticatedThemes).mockResolvedValue(session)
  const info = new Info(['--password=test-password', ...argv], CommandConfig)
  await info.run()
}

function executeConcurrentProcessesInOrder() {
  vi.mocked(renderConcurrent).mockImplementation(async ({processes}) => {
    for (const process of processes) {
      // eslint-disable-next-line no-await-in-loop
      await process.action({} as Writable, {} as Writable, {} as never)
    }
  })
}

describe('Info', () => {
  beforeEach(() => {
    mockAndCaptureOutput().clear()
    vi.mocked(loadEnvironment).mockReset()
    vi.mocked(renderConcurrent).mockReset()
    vi.mocked(recordTiming).mockClear()
    vi.mocked(renderError).mockClear()
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
      new URL('../../../../../eslint-plugin-cli/rules/json-output-command-exceptions.js', import.meta.url),
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

  describe('multi-environment JSON output', () => {
    test('collects requested environments in order even when completion order differs', async () => {
      vi.mocked(loadEnvironment)
        .mockResolvedValueOnce({store: 'store1.myshopify.com', theme: '123'})
        .mockResolvedValueOnce({store: 'store2.myshopify.com', theme: '456'})
        .mockResolvedValueOnce({store: 'store3.myshopify.com', theme: '789'})
      vi.mocked(fetchThemeInfo).mockResolvedValue(themeResult)
      vi.mocked(renderConcurrent).mockImplementation(async ({processes}) => {
        for (const process of [...processes].reverse()) {
          // eslint-disable-next-line no-await-in-loop
          await process.action({} as Writable, {} as Writable, {} as never)
        }
      })
      const output = mockAndCaptureOutput()
      output.clear()

      await runMultiEnvironment([
        '--environment',
        'first',
        '--environment',
        'second',
        '--environment',
        'third',
        '--json',
      ])

      expect(JSON.parse(output.output())).toEqual({
        environments: [
          {environment: 'first', result: themeResult},
          {environment: 'second', result: themeResult},
          {environment: 'third', result: themeResult},
        ],
      })
    })

    test('writes one multi-environment JSON document to stdout with no text on stderr', async () => {
      const originalUnitTestEnv = process.env.SHOPIFY_UNIT_TEST
      process.env.SHOPIFY_UNIT_TEST = 'false'
      vi.resetModules()
      const streams = captureStandardStreams()

      try {
        const {default: StreamInfo} = await import('./info.js')
        const {fetchThemeInfo, getThemeEnvironmentInfo} = await import('../../services/info.js')
        const {ensureAuthenticatedThemes} = await import('@shopify/cli-kit/node/session')
        const {renderConcurrent} = await import('@shopify/cli-kit/node/ui')
        const {loadEnvironment} = await import('@shopify/cli-kit/node/environments')
        const {Config} = await import('@oclif/core')
        const streamConfig = new Config({root: __dirname})
        await streamConfig.load()
        vi.mocked(ensureAuthenticatedThemes).mockResolvedValue(session)
        vi.mocked(loadEnvironment)
          .mockResolvedValueOnce({store: 'store1.myshopify.com', theme: '123'})
          .mockResolvedValueOnce({store: 'store2.myshopify.com'})
        vi.mocked(fetchThemeInfo).mockResolvedValue(themeResult)
        vi.mocked(getThemeEnvironmentInfo).mockReturnValue({result: environmentResult, developmentTheme: undefined})
        vi.mocked(renderConcurrent).mockImplementation(async ({processes}) => {
          for (const process of processes) {
            // eslint-disable-next-line no-await-in-loop
            await process.action({} as Writable, {} as Writable, {} as never)
          }
        })

        await new StreamInfo(
          ['--password=test-password', '--environment', 'theme-env', '--environment', 'environment-env', '--json'],
          streamConfig,
        ).run()
      } finally {
        streams.restore()
        restoreUnitTestEnvironment(originalUnitTestEnv)
      }

      expect(JSON.parse(streams.stdout())).toEqual({
        environments: [
          {environment: 'theme-env', result: themeResult},
          {environment: 'environment-env', result: environmentResult},
        ],
      })
      expect(streams.stderr()).toBe('')
    })

    test('omits failed environments and keeps their errors on stderr', async () => {
      vi.mocked(loadEnvironment)
        .mockResolvedValueOnce({store: 'store1.myshopify.com', theme: '123'})
        .mockResolvedValueOnce({store: 'store2.myshopify.com', theme: '404'})
        .mockResolvedValueOnce({store: 'store3.myshopify.com', theme: '789'})
      vi.mocked(fetchThemeInfo).mockImplementation(async (_session, options) =>
        options.theme === '404' ? undefined : themeResult,
      )
      executeConcurrentProcessesInOrder()
      const output = mockAndCaptureOutput()
      output.clear()

      await runMultiEnvironment(['--environment', 'ok', '--environment', 'bad', '--environment', 'another', '--json'])

      expect(JSON.parse(output.output())).toEqual({
        environments: [
          {environment: 'ok', result: themeResult},
          {environment: 'another', result: themeResult},
        ],
      })
      expect(renderError).toHaveBeenCalledWith(
        expect.objectContaining({body: ['Environment bad failed: \n\nTheme not found!']}),
      )
    })

    test('emits an empty wrapper when every environment fails and preserves exit behavior', async () => {
      vi.mocked(loadEnvironment)
        .mockResolvedValueOnce({store: 'store1.myshopify.com', theme: '123'})
        .mockResolvedValueOnce({store: 'store2.myshopify.com', theme: '456'})
      vi.mocked(fetchThemeInfo).mockResolvedValue(undefined)
      executeConcurrentProcessesInOrder()
      const output = mockAndCaptureOutput()
      output.clear()

      await expect(
        runMultiEnvironment(['--environment', 'first', '--environment', 'second', '--json']),
      ).resolves.toBeUndefined()

      expect(JSON.parse(output.output())).toEqual({environments: []})
      expect(renderError).toHaveBeenCalledTimes(2)
    })

    test('does not emit the JSON wrapper in text mode', async () => {
      vi.mocked(loadEnvironment)
        .mockResolvedValueOnce({store: 'store1.myshopify.com', theme: '123'})
        .mockResolvedValueOnce({store: 'store2.myshopify.com', theme: '456'})
      vi.mocked(fetchThemeInfo).mockResolvedValue(themeResult)
      executeConcurrentProcessesInOrder()
      const output = mockAndCaptureOutput()
      output.clear()

      await runMultiEnvironment(['--environment', 'first', '--environment', 'second'])

      expect(output.output()).toBe('')
      expect(renderInfo).toHaveBeenCalledTimes(2)
    })
  })

  describe('analytics timing', () => {
    test('records only the opening timing in JSON mode', async () => {
      vi.mocked(fetchThemeInfo).mockResolvedValue(themeResult)

      await run(['--theme', '123', '--json'])

      expect(vi.mocked(recordTiming).mock.calls).toEqual([['theme-command:info']])
    })

    test('records opening and closing timings in text mode', async () => {
      vi.mocked(fetchThemeInfo).mockResolvedValue(themeResult)

      await run(['--theme', '123'])

      expect(vi.mocked(recordTiming).mock.calls).toEqual([['theme-command:info'], ['theme-command:info']])
    })
  })
})
