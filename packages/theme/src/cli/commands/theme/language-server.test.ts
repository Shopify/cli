import LanguageServer from './language-server.js'
import {startServer} from '@shopify/theme-language-server-node'
import {Config, Errors} from '@oclif/core'
import {afterEach, beforeEach, expect, test, vi} from 'vitest'
import {AbortError, handler} from '@shopify/cli-kit/node/error'
import {outputWarn} from '@shopify/cli-kit/node/output'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {renderCommandEventAsJson, runWithCommandEvents} from '@shopify/cli-kit/node/command-events'

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

test('documents the native protocol and JSON flag policy', () => {
  expect(LanguageServer.jsonOutputSchema).toBeUndefined()
  expect(LanguageServer.flags).toHaveProperty('json')
  expect(LanguageServer.descriptionForHelp()).toContain('Content-Length')
  expect(LanguageServer.descriptionForHelp()).toContain('SHOPIFY_FLAG_JSON')
})
