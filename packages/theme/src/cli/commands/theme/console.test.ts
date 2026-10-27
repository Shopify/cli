import Console from './console.js'
import {ensureReplEnv, evaluateConsoleInputs, initializeRepl} from '../../services/console.js'
import {themeConsoleJsonOutputSchema} from '../../services/console/types.js'
import {afterEach, expect, test, vi} from 'vitest'
import {Config} from '@oclif/core'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'
import {loadEnvironment} from '@shopify/cli-kit/node/environments'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'

vi.mock('../../services/console.js')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/environments')

afterEach(() => vi.unstubAllEnvs())

function restoreExitCode(value: typeof process.exitCode): void {
  process.exitCode = value
}

async function runConsole(argv: string[]) {
  const config = new Config({root: __dirname})
  await config.load()
  vi.mocked(ensureAuthenticatedThemes).mockResolvedValue({storeFqdn: 'shop.myshopify.com', token: 'token'})
  vi.mocked(ensureReplEnv).mockResolvedValue({themeId: '123', storePassword: undefined})
  await new Console(['--store=shop.myshopify.com', '--password=token', ...argv], config).run()
}

test.each([{flags: []}, {flags: ['--no-input']}])(
  'rejects JSON without supplied commands before authentication: $flags',
  async ({flags}) => {
    await expect(runConsole(['--json', ...flags])).rejects.toThrow('Use --script or --script-file with --json')
    expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
    expect(ensureReplEnv).not.toHaveBeenCalled()
  },
)

test('rejects conflicting script flags before authentication', async () => {
  await expect(runConsole(['--script', 'shop.name', '--script-file', 'commands.txt', '--json'])).rejects.toThrow()
  expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
})

test.each(['', '  '])('rejects blank inline commands: %j', async (input) => {
  await expect(runConsole(['--script', input, '--json'])).rejects.toThrow('Each --script must contain a Liquid command')
  expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
})

test.each([false, true])('writes one document for repeated scripts with no-input=%s', async (noInput) => {
  const result = {
    status: 'success' as const,
    results: [
      {input: 'shop.name', status: 'success' as const, value: 'Test shop'},
      {input: 'false', status: 'success' as const, value: false},
    ],
  }
  vi.mocked(evaluateConsoleInputs).mockResolvedValue(result)

  await withCapturedStandardStreams(async (streams) => {
    await runConsole(['--script', 'shop.name', '--script', 'false', '--json', ...(noInput ? ['--no-input'] : [])])
    expect(JSON.parse(streams.stdout())).toEqual(result)
    expect(streams.stderr()).toBe('')
    expect(streams.stdout()).not.toContain('Welcome')
  })
  expect(evaluateConsoleInputs).toHaveBeenCalledWith({
    inputs: ['shop.name', 'false'],
    adminSession: {storeFqdn: 'shop.myshopify.com', token: 'token'},
    themeId: '123',
    url: '/',
    themeAccessPassword: 'token',
    storefrontPassword: undefined,
  })
  expect(initializeRepl).not.toHaveBeenCalled()
})

test('reads commands from a real file before setting up the console session', async () => {
  vi.mocked(evaluateConsoleInputs).mockResolvedValue({status: 'success', results: []})
  await inTemporaryDirectory(async (directory) => {
    const scriptFile = joinPath(directory, 'commands.txt')
    await writeFile(scriptFile, 'shop.name\r\nshop.currency\r\n')
    await runConsole(['--script-file', scriptFile, '--json'])
  })
  expect(evaluateConsoleInputs).toHaveBeenCalledWith(expect.objectContaining({inputs: ['shop.name', 'shop.currency']}))
})

test('rejects a missing file before creating the REPL theme', async () => {
  await inTemporaryDirectory(async (directory) => {
    await expect(runConsole(['--script-file', joinPath(directory, 'missing.txt'), '--json'])).rejects.toThrow()
  })
  expect(ensureReplEnv).not.toHaveBeenCalled()
})

test('runs supplied commands in text mode without starting the REPL', async () => {
  vi.mocked(evaluateConsoleInputs).mockResolvedValue({
    status: 'success',
    results: [{input: 'shop.name', status: 'success', value: 'Test shop'}],
  })
  await withCapturedStandardStreams(async (streams) => {
    await runConsole(['--script', 'shop.name', '--no-input'])
    expect(streams.stderr()).toContain('"Test shop"')
    expect(streams.stdout()).toBe('')
  })
  expect(initializeRepl).not.toHaveBeenCalled()
})

test('keeps the interactive console when scripts are omitted', async () => {
  await runConsole([])
  expect(initializeRepl).toHaveBeenCalledWith(
    {storeFqdn: 'shop.myshopify.com', token: 'token'},
    '123',
    '/',
    'token',
    undefined,
  )
  expect(evaluateConsoleInputs).not.toHaveBeenCalled()
})

test('returns failed results with a nonzero exit code', async () => {
  const result = {
    status: 'partial' as const,
    results: [
      {input: 'invalid', status: 'failed' as const, error: {type: 'abort' as const, message: 'Invalid command'}},
    ],
  }
  vi.mocked(evaluateConsoleInputs).mockResolvedValue(result)
  const previousExitCode = process.exitCode
  try {
    await withCapturedStandardStreams(async (streams) => {
      await runConsole(['--script', 'invalid', '--json'])
      expect(JSON.parse(streams.stdout())).toEqual(result)
      expect(process.exitCode).toBe(1)
    })
  } finally {
    restoreExitCode(previousExitCode)
  }
})

test('does not write a result when session setup fails', async () => {
  vi.mocked(evaluateConsoleInputs).mockRejectedValue(new AbortError('Session expired'))
  await withCapturedStandardStreams(async (streams) => {
    await expect(runConsole(['--script', 'shop.name', '--json'])).rejects.toThrow('Session expired')
    expect(streams.stdout()).toBe('')
  })
})

test('wraps a named environment in the theme environment contract', async () => {
  const result = {
    status: 'success' as const,
    results: [{input: 'shop.name', status: 'success' as const, value: 'Shop'}],
  }
  vi.mocked(loadEnvironment).mockResolvedValue({store: 'shop.myshopify.com', password: 'token'})
  vi.mocked(evaluateConsoleInputs).mockResolvedValue(result)
  await withCapturedStandardStreams(async (streams) => {
    await runConsole(['--environment', 'development', '--script', 'shop.name', '--json'])
    expect(JSON.parse(streams.stdout())).toEqual({environments: [{environment: 'development', result}]})
  })
})

test('exposes a strict schema that preserves native Liquid values', () => {
  expect(Console.jsonOutputSchema).toBe(themeConsoleJsonOutputSchema)
  for (const value of [null, false, 0, '', [1, false], {product_id: 1, tags: ['a']}]) {
    const result = {status: 'success', results: [{input: 'value', status: 'success', value}]}
    expect(JSON.parse(themeConsoleJsonOutputSchema.encode(result))).toEqual(result)
  }
  expect(() => themeConsoleJsonOutputSchema.encode({status: 'success', results: [], extra: true})).toThrow()
})
