import HelpCommand from './help.js'
import ShopifyHelp from '../help.js'
import {helpJsonOutputSchema} from '../services/commands/help/types.js'
import {Errors, loadHelpClass} from '@oclif/core'
import {launchCLI} from '@shopify/cli-kit/node/cli-launcher'
import {ShopifyConfig} from '@shopify/cli-kit/node/custom-oclif-loader'
import {mockAndCaptureOutput, withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {afterEach, describe, expect, test, vi} from 'vitest'
import {createRequire} from 'node:module'

vi.mock('@oclif/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@oclif/core')>()),
  default: undefined,
  loadHelpClass: vi.fn(),
}))

afterEach(() => {
  vi.unstubAllEnvs()
  mockAndCaptureOutput().clear()
})

describe('help command', () => {
  test('delegates text help to the configured oclif renderer', async () => {
    vi.mocked(loadHelpClass).mockResolvedValue(ShopifyHelp)
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

  test('exposes the result schema in help', () => {
    expect(HelpCommand.jsonOutputSchema).toBe(helpJsonOutputSchema)
    expect(HelpCommand.description).toContain('Output from `--json` conforms to the `HelpResult` schema.')
  })

  test.each([
    {args: ['help', '--json'], kind: 'root'},
    {args: ['help', 'app', '--json'], kind: 'topic'},
    {args: ['help', 'version', '--json'], kind: 'command'},
    {args: ['help', '--json-schema'], kind: 'schema'},
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
        if (kind === 'schema') {
          expect(document.definitions.Result.anyOf).toHaveLength(3)
        } else if (kind === 'error') {
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
