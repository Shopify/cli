import HelpCommand from './help.js'
import ShopifyHelp from '../help.js'
import {helpJsonOutputSchema} from '../services/commands/help/types.js'
import {loadHelpClass} from '@oclif/core'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {afterEach, describe, expect, test, vi} from 'vitest'
import {execa} from 'execa'

vi.mock('@oclif/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@oclif/core')>()),
  loadHelpClass: vi.fn(),
}))

afterEach(() => {
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
  ])('writes one $kind document through the launcher', {timeout: 60000}, async ({args, kind}) => {
    const commandUrl = new URL('./help.ts', import.meta.url).href
    const cliKitLoaderUrl = new URL('../../../../cli-kit/test/fixtures/cli-kit-source-loader.js', import.meta.url).href
    const compiledHelpUrl = new URL('../../../dist/cli/help.js', import.meta.url).href
    const sourceHelpUrl = new URL('../help.js', import.meta.url).href
    // Oclif loads the help class outside the lazy command loader. CI needs to load it from source too.
    const sourceLoader = `
      export function resolve(specifier, context, nextResolve) {
        if (specifier === ${JSON.stringify(compiledHelpUrl)}) {
          return nextResolve(${JSON.stringify(sourceHelpUrl)}, context)
        }
        return nextResolve(specifier, context)
      }
    `
    const sourceLoaderUrl = `data:text/javascript,${encodeURIComponent(sourceLoader)}`
    const script = `
      process.argv = [process.execPath, 'shopify', ...${JSON.stringify(args)}]
      const {default: HelpCommand} = await import(${JSON.stringify(commandUrl)})
      const {launchCLI} = await import('@shopify/cli-kit/node/cli-launcher')
      await launchCLI({
        moduleURL: ${JSON.stringify(commandUrl)},
        lazyCommandLoader: async () => {
          if (process.argv.includes('--help') || process.argv.includes('-h')) {
            throw new Error('Help must not execute a command')
          }
          return HelpCommand
        },
      })
    `

    const result = await execa(
      process.execPath,
      [
        '--loader',
        'ts-node/esm',
        '--loader',
        cliKitLoaderUrl,
        '--loader',
        sourceLoaderUrl,
        '--input-type=module',
        '--eval',
        script,
      ],
      {
        env: {
          ...process.env,
          FORCE_COLOR: '0',
          NODE_NO_WARNINGS: '1',
          SHOPIFY_CLI_ENV: 'development',
          SHOPIFY_CLI_NO_ANALYTICS: '1',
          SHOPIFY_UNIT_TEST: 'false',
        },
        reject: false,
        // Source-loader startup can exceed 20 seconds on Windows CI. Stop a hung child before the test times out.
        timeout: 45000,
      },
    )

    expect(result.exitCode).toBe(kind === 'error' ? 2 : 0)
    expect(result.stderr).toBe('')
    const document = JSON.parse(result.stdout)
    if (kind === 'schema') {
      expect(document.definitions.Result.anyOf).toHaveLength(3)
    } else if (kind === 'error') {
      expect(document).toEqual({error: {type: 'abort', message: 'Command missing-command not found.'}})
    } else {
      expect(document.kind).toBe(kind)
      expect(helpJsonOutputSchema.validate(document)).toEqual(document)
    }
  })
})
