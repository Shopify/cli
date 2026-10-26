import LanguageServer from './language-server.js'
import {startServer} from '@shopify/theme-language-server-node'
import {Config, Errors} from '@oclif/core'
import {afterEach, beforeEach, expect, test, vi} from 'vitest'
import {AbortError, handler} from '@shopify/cli-kit/node/error'
import {outputWarn} from '@shopify/cli-kit/node/output'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {renderCommandEventAsJson, runWithCommandEvents} from '@shopify/cli-kit/node/command-events'
import {launchCLI} from '@shopify/cli-kit/node/cli-launcher'
import {inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'

vi.mock('@shopify/theme-language-server-node')
vi.mock('@shopify/cli-kit/node/error-handler', () => ({errorHandler: (error: Error) => handler(error)}))

class TestLanguageServer extends LanguageServer {
  async execute() {
    return this._run()
  }

  protected async init() {}
}

beforeEach(() => {
  vi.spyOn(Errors, 'handle').mockImplementation((error) => {
    throw error
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

test.each([
  {argv: ['--no-input'], json: '0'},
  {argv: ['--no-input'], json: '1'},
  {argv: ['--json', '--no-input'], json: '0'},
  {argv: ['-j', '--no-input'], json: '0'},
])('preserves LSP output and diagnostics with $argv and global JSON=$json', async ({argv, json}) => {
  vi.stubEnv('SHOPIFY_FLAG_JSON', json)
  const instance = new TestLanguageServer(argv, await Config.load())
  const frame = 'Content-Length: 38\r\n\r\n{"jsonrpc":"2.0","id":2,"result":null}'
  vi.mocked(startServer).mockImplementation(() => {
    process.stdout.write(frame)
    outputWarn('Language server diagnostic')
  })

  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await runWithCommandEvents({outputMode: 'json', sink: renderCommandEventAsJson}, () => instance.execute())
    expect(stdout()).toBe(frame)
    expect(stderr()).toContain('Language server diagnostic')
    expect(stderr()).not.toContain('"type":"diagnostic"')
  })
  expect(startServer).toHaveBeenCalledExactlyOnceWith()
})

test.each([{argv: []}, {argv: ['--json']}, {argv: ['-j']}])(
  'keeps fatal startup errors on stderr with $argv',
  async ({argv}) => {
    vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
    const instance = new TestLanguageServer(argv, await Config.load())
    vi.mocked(startServer).mockImplementation(() => {
      throw new AbortError('Language server startup failed')
    })

    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await expect(instance.execute()).rejects.toThrow('Language server startup failed')
      expect(stdout()).toBe('')
      expect(stderr()).toContain('Language server startup failed')
      expect(stderr()).not.toContain('"error":')
    })
  },
)

test.each([{argv: []}, {argv: ['--json']}, {argv: ['-j']}])(
  'keeps argument errors on stderr with $argv',
  async ({argv}) => {
    const instance = new TestLanguageServer([...argv, '--invalid'], await Config.load())

    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await expect(instance.execute()).rejects.toThrow('Nonexistent flag: --invalid')
      expect(stdout()).toBe('')
      expect(stderr()).toContain('--invalid')
    })
    expect(startServer).not.toHaveBeenCalled()
  },
)

test.each([
  {flags: ['--json-schema'], environment: '0'},
  {flags: ['--json', '--json-schema'], environment: '0'},
  {flags: [], environment: '1'},
])(
  'prints the native message schema without starting the server with $flags and env=$environment',
  async ({flags, environment}) => {
    vi.stubEnv('SHOPIFY_FLAG_JSON_SCHEMA', environment)
    const execute = vi.spyOn(LanguageServer, 'run').mockResolvedValue(undefined)
    const require = createRequire(import.meta.url)

    await inTemporaryDirectory(async (directory) => {
      await writeFile(
        joinPath(directory, 'package.json'),
        JSON.stringify({
          name: 'language-server-schema-test',
          version: '1.0.0',
          type: 'module',
          oclif: {commands: './commands', topicSeparator: ' '},
        }),
      )
      await mkdir(joinPath(directory, 'commands', 'theme'))
      await writeFile(
        joinPath(directory, 'commands', 'theme', 'language-server.js'),
        `import {Command} from '${pathToFileURL(require.resolve('@oclif/core')).href}'
export default class extends Command {
  async run() { throw new Error('Schema inspection must not start the server') }
}`,
      )

      await withCapturedStandardStreams(async ({stdout}) => {
        await launchCLI({
          moduleURL: pathToFileURL(joinPath(directory, 'index.js')).href,
          argv: ['theme', 'language-server', ...flags],
          lazyCommandLoader: vi.fn().mockResolvedValue(LanguageServer),
        })

        const schema = JSON.parse(stdout())
        expect(schema.anyOf).toContainEqual({$ref: '#/definitions/Result'})
        expect(schema.definitions.Result.description).toContain('Content-Length')
        expect(schema.definitions.LspSuccessResponse.required).toEqual(['jsonrpc', 'id', 'result'])
      })
    })

    expect(execute).not.toHaveBeenCalled()
    expect(startServer).not.toHaveBeenCalled()
  },
)

test('documents the native protocol and JSON flag policy', () => {
  expect(LanguageServer.jsonOutputSchema?.name).toBe('ThemeLanguageServerMessage')
  expect(LanguageServer.flags).toHaveProperty('json')
  expect(LanguageServer.descriptionForHelp()).toContain('Content-Length')
  expect(LanguageServer.descriptionForHelp()).toContain('SHOPIFY_FLAG_JSON')
})
