import HelpCommand from './help.js'
import ShopifyHelp from '../help.js'
import * as helpServices from '../services/commands/help/index.js'
import {helpJsonOutputSchema, type HelpResult} from '../services/commands/help/types.js'
import {Errors} from '@oclif/core'
import * as oclif from '@oclif/core'
import {launchCLI} from '@shopify/cli-kit/node/cli-launcher'
import {ShopifyConfig} from '@shopify/cli-kit/node/custom-oclif-loader'
import {mockAndCaptureOutput, withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {afterEach, describe, expect, test, vi, type MockInstance} from 'vitest'
import {describeJsonCommand} from '@shopify/cli-kit/node/testing/json-command'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {createRequire} from 'node:module'

const loadHelpClass = vi.spyOn(oclif, 'loadHelpClass')

afterEach(() => {
  vi.unstubAllEnvs()
  mockAndCaptureOutput().clear()
})

const helpResult: HelpResult = {
  kind: 'command',
  command: {
    id: 'version',
    hidden: false,
    aliases: [],
    strict: true,
    args: {},
    flags: {json: {name: 'json', type: 'boolean', required: false, hidden: false}},
  },
  commands: [],
  topics: [],
}
let helpService: MockInstance<typeof helpServices.helpService>
let showHelp: MockInstance<typeof ShopifyHelp.prototype.showHelp>

describeJsonCommand({
  command: HelpCommand,
  commandId: 'help',
  moduleURL: import.meta.url,
  args: ['version'],
  expectedResult: helpResult,
  expectedSchema: {anyOf: [{type: 'object'}, {type: 'object'}, {type: 'object'}]},
  setup: () => {
    helpService = vi.spyOn(helpServices, 'helpService').mockResolvedValue(helpResult)
    loadHelpClass.mockResolvedValue(ShopifyHelp)
    showHelp = vi.spyOn(ShopifyHelp.prototype, 'showHelp')
    return () => {
      helpService.mockRestore()
      showHelp.mockRestore()
    }
  },
  assertExecuted: (format) => {
    if (format === 'json') {
      expect(helpService).toHaveBeenCalledExactlyOnceWith(expect.anything(), ['version'], false)
      expect(loadHelpClass).not.toHaveBeenCalled()
      expect(showHelp).not.toHaveBeenCalled()
    } else {
      expect(helpService).not.toHaveBeenCalled()
      expect(loadHelpClass).toHaveBeenCalledOnce()
      expect(showHelp).toHaveBeenCalledExactlyOnceWith(['version'])
    }
  },
  assertNotExecuted: () => {
    expect(helpService).not.toHaveBeenCalled()
    expect(loadHelpClass).not.toHaveBeenCalled()
    expect(showHelp).not.toHaveBeenCalled()
  },
  textOutput: ({stdout, stderr}) => {
    expect(stdout).toContain('Shopify CLI version currently installed.')
    expect(stderr).toBe('')
  },
  diagnostics: {
    setup: () => {
      helpService.mockImplementation(async () => {
        outputInfo('Help diagnostic')
        return helpResult
      })
    },
    expectedEvents: [{type: 'diagnostic', level: 'info', message: 'Help diagnostic'}],
  },
  failure: {
    setup: () => {
      helpService.mockRejectedValue(new AbortError('Cannot load help metadata.'))
    },
    expectedError: {error: {type: 'abort', message: 'Cannot load help metadata.'}},
    exitCode: 1,
  },
})

describe('help command', () => {
  test('delegates text help to the configured oclif renderer', async () => {
    loadHelpClass.mockResolvedValue(ShopifyHelp)
    const showHelp = vi.spyOn(ShopifyHelp.prototype, 'showHelp').mockResolvedValue()

    await HelpCommand.run(['app', 'config', '-n'], import.meta.url)

    expect(loadHelpClass).toHaveBeenCalledOnce()
    expect(showHelp).toHaveBeenCalledWith(['app', 'config'])
    showHelp.mockRestore()
  })

  test('prints command metadata as JSON', async () => {
    const output = mockAndCaptureOutput()

    await HelpCommand.run(['version', '--json'], import.meta.url)

    const result = JSON.parse(output.output())
    expect(result).toMatchObject({kind: 'command', command: {id: 'version', flags: {json: {type: 'boolean'}}}})
    expect(helpJsonOutputSchema.validate(result)).toEqual(result)
    expect(output.warn()).toBe('')
    expect(loadHelpClass).not.toHaveBeenCalled()
  })

  test.each([
    {args: ['help', '--json'], kind: 'root'},
    {args: ['help', 'app', '--json'], kind: 'topic'},
    {args: ['help', 'version', '--json'], kind: 'command'},
    {args: ['help', 'missing-command', '--json'], kind: 'error'},
    {args: ['--help', '--json'], kind: 'root'},
    {args: ['app', 'config', '--help', '--json'], kind: 'topic'},
    {args: ['version', '--help', '--json'], kind: 'command'},
    {args: ['version', '-h', '-j'], kind: 'command'},
    {args: ['missing-command', '--help', '--json'], kind: 'error'},
  ])('writes one $kind document through the launcher', async ({args, kind}) => {
    const require = createRequire(import.meta.url)
    // Oclif's CommonJS launcher loads help outside Vitest's module mocks.
    const oclifHelp: typeof import('@oclif/core/help') = require('@oclif/core/help')
    const helpLoader = vi.spyOn(oclifHelp, 'loadHelpClass').mockResolvedValue(ShopifyHelp)
    const handleError = vi.spyOn(Errors, 'handle').mockResolvedValue()
    // Keep upgrade checks and other lifecycle hooks out of output assertions.
    vi.spyOn(ShopifyConfig.prototype, 'runHook').mockResolvedValue({successes: [], failures: []})
    vi.stubEnv('CI', '1')
    vi.stubEnv('SHOPIFY_CLI_NO_ANALYTICS', '1')
    const lazyCommandLoader = vi.fn().mockResolvedValue(HelpCommand)
    const originalArgv = process.argv
    process.argv = [process.execPath, 'shopify', ...args]

    try {
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await launchCLI({moduleURL: import.meta.url, argv: args, lazyCommandLoader})

        if (args.includes('--help') || args.includes('-h')) {
          expect(lazyCommandLoader).not.toHaveBeenCalled()
        } else {
          expect(lazyCommandLoader).toHaveBeenCalledExactlyOnceWith('help')
        }
        if (kind === 'error') {
          expect(handleError).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({oclif: {exit: 2}, skipOclifErrorHandling: true}),
          )
        } else {
          expect(handleError).not.toHaveBeenCalled()
        }
        expect(stderr()).toBe('')
        const document = JSON.parse(stdout())
        if (kind === 'error') {
          expect(document).toEqual({error: {type: 'abort', message: 'Command missing-command not found.'}})
        } else {
          expect(document.kind).toBe(kind)
          expect(helpJsonOutputSchema.validate(document)).toEqual(document)
        }
      })
    } finally {
      helpLoader.mockRestore()
      handleError.mockRestore()
      // These tests run sequentially and must restore argv even when an assertion fails.
      // eslint-disable-next-line require-atomic-updates
      process.argv = originalArgv
    }
  })
})
