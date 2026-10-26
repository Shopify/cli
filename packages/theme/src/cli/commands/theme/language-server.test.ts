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

test.each([false, true])('keeps diagnostics off the protocol with global JSON=%s', async (json) => {
  vi.stubEnv('SHOPIFY_FLAG_JSON', json ? '1' : '0')
  const instance = new TestLanguageServer(['--no-input'], await Config.load())
  vi.mocked(startServer).mockImplementation(() => {
    outputWarn('Language server diagnostic')
  })

  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await runWithCommandEvents({outputMode: 'json', sink: renderCommandEventAsJson}, () => instance.execute())
    expect(stdout()).toBe('')
    expect(stderr()).toContain('Language server diagnostic')
    expect(stderr()).not.toContain('"type":"diagnostic"')
  })
  expect(startServer).toHaveBeenCalledExactlyOnceWith()
})

test('keeps fatal startup errors on stderr with global JSON enabled', async () => {
  vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
  const instance = new TestLanguageServer([], await Config.load())
  vi.mocked(startServer).mockImplementation(() => {
    throw new AbortError('Language server startup failed')
  })

  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await expect(instance.execute()).rejects.toThrow('Language server startup failed')
    expect(stdout()).toBe('')
    expect(stderr()).toContain('Language server startup failed')
  })
})

test('rejects --json on stderr before starting the server', async () => {
  const instance = new TestLanguageServer(['--json'], await Config.load())

  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await expect(instance.execute()).rejects.toThrow('Nonexistent flag: --json')
    expect(stdout()).toBe('')
    expect(stderr()).toContain('--json')
  })
  expect(startServer).not.toHaveBeenCalled()
})

test('documents the native protocol and JSON flag policy', () => {
  expect(LanguageServer.jsonOutputSchema).toBeUndefined()
  expect(LanguageServer.flags).not.toHaveProperty('json')
  expect(LanguageServer.descriptionForHelp()).toContain('Content-Length')
  expect(LanguageServer.descriptionForHelp()).toContain('SHOPIFY_FLAG_JSON')
})
