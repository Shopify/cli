import Info from './info.js'
import {fetchThemeInfo, getThemeEnvironmentInfo} from '../../services/info.js'
import {themeResultJsonSchema} from '../../services/json-output/schema.test-data.js'
import * as infoResult from '../../services/info/result.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {Config} from '@oclif/core'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {mockAndCaptureOutput, withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {describeJsonCommand} from '@shopify/cli-kit/node/testing/json-command'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {renderConcurrent, renderInfo} from '@shopify/cli-kit/node/ui'
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

const secondThemeResult = {
  theme: {
    id: 456,
    name: 'second theme',
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

const publicThemeResult = {
  theme: {
    id: '123',
    name: 'my theme',
    role: 'live',
    storeDomain: 'my-shop.myshopify.com',
    previewUrl: 'https://my-shop.myshopify.com/preview',
    editorUrl: 'https://my-shop.myshopify.com/editor',
  },
}
const publicEnvironmentResult = {
  storeDomain: 'my-shop.myshopify.com',
  developmentThemeId: null,
  cliVersion: '3.91.0',
  os: 'darwin-arm64',
  shell: '/bin/zsh',
  nodeVersion: 'v24.15.0',
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
  })

  describe('when theme or development flag is provided', () => {
    test('throws an error when theme is not found without rendering a result', async () => {
      vi.mocked(fetchThemeInfo).mockResolvedValue(undefined)

      await expect(run(['--theme', '999'])).rejects.toThrow('Theme not found!')
      expect(renderInfo).not.toHaveBeenCalled()
      expect(mockAndCaptureOutput().output()).toBe('')
    })
  })

  test('is removed from the JSON legacy exemption list', () => {
    const legacyCommandPaths = readFileSync(
      new URL('../../../../../eslint-plugin-cli/rules/json-output-command-exceptions.js', import.meta.url),
      'utf8',
    )

    expect(legacyCommandPaths).not.toContain("'packages/theme/src/cli/commands/theme/info.ts'")
  })

  describe('multi-environment JSON output', () => {
    test('emits one ordered object for every requested environment', async () => {
      vi.mocked(loadEnvironment)
        .mockResolvedValueOnce({store: 'store1.myshopify.com', theme: '123'})
        .mockResolvedValueOnce({store: 'store2.myshopify.com', theme: '456'})
      vi.mocked(fetchThemeInfo).mockImplementation(async (_session, options) =>
        options.theme === '456' ? secondThemeResult : themeResult,
      )
      executeConcurrentProcessesInOrder()
      const output = mockAndCaptureOutput()
      output.clear()

      await runMultiEnvironment(['--environment', 'first', '--environment', 'second', '--json'])

      const expectedOutput = JSON.stringify(
        {
          environments: [
            {environment: 'first', result: publicThemeResult},
            {environment: 'second', result: {theme: {...publicThemeResult.theme, id: '456', name: 'second theme'}}},
          ],
        },
        null,
        2,
      )

      expect(output.output()).toBe(expectedOutput)
      expect(JSON.parse(output.output()).environments).toHaveLength(2)
      expect(renderInfo).not.toHaveBeenCalled()
    })

    test('renders each environment result independently in text mode', async () => {
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

  test('wraps a single explicitly requested environment', async () => {
    vi.mocked(loadEnvironment).mockResolvedValue({store: 'store1.myshopify.com', theme: '123'})
    vi.mocked(fetchThemeInfo).mockResolvedValue(themeResult)
    await runMultiEnvironment(['--environment', 'first', '--json'])
    expect(JSON.parse(mockAndCaptureOutput().output())).toEqual({
      environments: [{environment: 'first', result: publicThemeResult}],
    })
  })

  test('retains a failed environment beside a successful result and exits nonzero', async () => {
    const originalExitCode = process.exitCode
    try {
      vi.mocked(loadEnvironment)
        .mockResolvedValueOnce({store: 'store1.myshopify.com', theme: '123'})
        .mockResolvedValueOnce({store: 'store2.myshopify.com', theme: '456'})
      vi.mocked(fetchThemeInfo).mockImplementation(async (_session, options) => {
        if (options.theme === '456') throw new Error('Transport failed')
        return themeResult
      })
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        const argv = ['--environment', 'first', '--environment', 'second', '--json']
        await runWithCommandEventsForCommand(argv, () => runMultiEnvironment(argv))
        expect(JSON.parse(stdout())).toEqual({
          environments: [
            {environment: 'first', result: publicThemeResult},
            {environment: 'second', error: {type: 'bug', message: 'Transport failed', stack: expect.any(String)}},
          ],
        })
        expect(JSON.parse(stderr())).toMatchObject({
          type: 'diagnostic',
          level: 'error',
          code: 'theme-environment-failed',
        })
      })
      expect(process.exitCode).toBe(1)
    } finally {
      process.exitCode = originalExitCode
    }
  })

  describe('analytics timing', () => {
    test.each([false, true])('records timings around fetching and presenting the result with json=%s', async (json) => {
      const pendingFetch = Promise.withResolvers<typeof themeResult>()
      const fetchStarted = Promise.withResolvers<void>()
      vi.mocked(fetchThemeInfo).mockImplementation(() => {
        fetchStarted.resolve()
        return pendingFetch.promise
      })
      const presentation = vi.spyOn(infoResult, 'renderThemeInfoResult')

      const runningCommand = run(['--theme', '123', ...(json ? ['--json'] : [])])
      await fetchStarted.promise

      expect(vi.mocked(recordTiming).mock.calls).toEqual([['theme-command:info']])
      expect(presentation).not.toHaveBeenCalled()

      pendingFetch.resolve(themeResult)
      await runningCommand

      expect(presentation).toHaveBeenCalledWith(themeResult, json ? 'json' : 'text', expect.any(Object))
      expect(vi.mocked(recordTiming).mock.calls).toEqual([['theme-command:info'], ['theme-command:info']])
      expect(vi.mocked(recordTiming).mock.invocationCallOrder[1]).toBeGreaterThan(
        presentation.mock.invocationCallOrder[0] ?? Infinity,
      )
    })
  })
})

describeJsonCommand({
  command: Info,
  commandId: 'theme:info',
  moduleURL: new URL('../../../../../cli/src/index.ts', import.meta.url).href,
  args: ['--store=my-shop.myshopify.com', '--password=test-password', '--theme', '123'],
  expectedResult: publicThemeResult,
  expectedSchema: themeResultJsonSchema,
  setup: () => {
    vi.mocked(ensureAuthenticatedThemes).mockResolvedValue(session)
    vi.mocked(fetchThemeInfo).mockResolvedValue(themeResult)
  },
  assertExecuted: (format) => {
    expect(ensureAuthenticatedThemes).toHaveBeenCalledExactlyOnceWith('my-shop.myshopify.com', 'test-password')
    expect(fetchThemeInfo).toHaveBeenCalledExactlyOnceWith(
      session,
      expect.objectContaining({theme: '123', json: format === 'json'}),
    )
    expect(getThemeEnvironmentInfo).not.toHaveBeenCalled()
    if (format === 'json') expect(renderInfo).not.toHaveBeenCalled()
  },
  assertNotExecuted: () => {
    expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
    expect(fetchThemeInfo).not.toHaveBeenCalled()
  },
  // The UI module is mocked, so text mode is checked through the rendered sections.
  textOutput: ({stdout}) => {
    expect(stdout).toBe('')
    expect(renderInfo).toHaveBeenCalledExactlyOnceWith({
      customSections: [
        {
          title: 'Theme Details',
          body: {
            tabularData: [
              ['Id', '#123'],
              ['Name', 'my theme'],
              ['Role', 'live'],
              ['Shop', 'my-shop.myshopify.com'],
              ['Preview Url', {link: {url: 'https://my-shop.myshopify.com/preview', label: 'Preview Theme'}}],
              ['Editor Url', {link: {url: 'https://my-shop.myshopify.com/editor', label: 'Open in Theme Editor'}}],
            ],
            firstColumnSubdued: true,
          },
        },
      ],
    })
  },
  failure: {
    setup: () => {
      vi.mocked(fetchThemeInfo).mockResolvedValue(undefined)
    },
    expectedError: {error: {type: 'abort', message: 'Theme not found!'}},
    exitCode: 1,
  },
})

describeJsonCommand({
  command: Info,
  commandId: 'theme:info',
  moduleURL: new URL('../../../../../cli/src/index.ts', import.meta.url).href,
  args: ['--store=my-shop.myshopify.com', '--password=test-password'],
  expectedResult: publicEnvironmentResult,
  expectedSchema: themeResultJsonSchema,
  setup: () => {
    vi.mocked(ensureAuthenticatedThemes).mockResolvedValue(session)
    vi.mocked(getThemeEnvironmentInfo).mockReturnValue({result: environmentResult, developmentTheme: undefined})
  },
  assertExecuted: (format) => {
    expect(getThemeEnvironmentInfo).toHaveBeenCalledExactlyOnceWith({cliVersion: expect.any(String)})
    expect(fetchThemeInfo).not.toHaveBeenCalled()
    if (format === 'json') expect(renderInfo).not.toHaveBeenCalled()
  },
  assertNotExecuted: () => expect(getThemeEnvironmentInfo).not.toHaveBeenCalled(),
  textOutput: ({stdout}) => {
    expect(stdout).toBe('')
    expect(renderInfo).toHaveBeenCalledExactlyOnceWith({
      customSections: [
        {
          title: 'Theme Configuration',
          body: {
            tabularData: [
              ['Store', 'my-shop.myshopify.com'],
              ['Development Theme ID', {subdued: 'Not set'}],
            ],
            firstColumnSubdued: true,
          },
        },
        {
          title: 'Tooling and System',
          body: {
            tabularData: [
              ['Shopify CLI', '3.91.0'],
              ['OS', 'darwin-arm64'],
              ['Shell', '/bin/zsh'],
              ['Node version', 'v24.15.0'],
            ],
            firstColumnSubdued: true,
          },
        },
      ],
    })
  },
})
