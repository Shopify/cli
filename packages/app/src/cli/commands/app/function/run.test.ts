import FunctionRun from './run.js'
import {chooseFunction} from '../../../services/function/common.js'
import {localAppContext} from '../../../services/app-context.js'
import {testApp, testFunctionExtension, testProject} from '../../../models/app/app.test-data.js'
import {functionRunnerBinary} from '../../../services/function/binaries.js'
import {Config} from '@oclif/core'
import {afterEach, expect, test, vi} from 'vitest'
import {captureOutputWithExitCode, exec, terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {renderAutocompletePrompt} from '@shopify/cli-kit/node/ui'
import {isTerminalInteractive} from '@shopify/cli-kit/node/context/local'
import {chmod, inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {cwd, joinPath} from '@shopify/cli-kit/node/path'
import {describeJsonCommand} from '@shopify/cli-kit/node/testing/json-command'

vi.mock('../../../services/app-context.js')
vi.mock('@shopify/cli-kit/node/system')
vi.mock('../../../services/function/common.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/function/common.js')>()),
  chooseFunction: vi.fn(),
  getOrGenerateSchemaPath: vi.fn(),
}))
vi.mock('../../../services/function/binaries.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/function/binaries.js')>()),
  downloadBinary: vi.fn(),
}))
vi.mock('@shopify/cli-kit/node/context/local', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/context/local')>()),
  isTerminalInteractive: vi.fn(),
}))
vi.mock('@shopify/cli-kit/node/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/ui')>()),
  renderAutocompletePrompt: vi.fn(),
}))

afterEach(() => vi.unstubAllEnvs())

const nativeResult = {
  name: 'function.wasm',
  size: 1,
  memory_usage: 64,
  instructions: 1000,
  logs: '',
  input: {},
  output: {operations: []},
  success: true,
}

async function command(argv: string[], targets = [{target: 'run', export: 'run'}]) {
  vi.mocked(localAppContext).mockResolvedValue({app: testApp(), project: testProject(), activeConfig: {} as never})
  const extension = await testFunctionExtension()
  extension.configuration.targeting = targets
  vi.mocked(chooseFunction).mockResolvedValue(extension)
  const instance = new FunctionRun(argv, await Config.load())
  return instance
}

test('writes the native result once and routes runner diagnostics to stderr', async () => {
  vi.mocked(captureOutputWithExitCode).mockResolvedValue({
    stdout: JSON.stringify(nativeResult),
    stderr: 'Runner warning',
    exitCode: 0,
  })
  const instance = await command(['--json', '--input', 'input.json', '--export', 'custom'])
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await runWithCommandEventsForCommand(instance.argv, () => instance.run())
    expect(JSON.parse(stdout())).toEqual(nativeResult)
    expect(JSON.parse(stderr())).toMatchObject({type: 'diagnostic', message: 'Runner warning'})
  })
  expect(captureOutputWithExitCode).toHaveBeenCalledWith(
    expect.any(String),
    expect.arrayContaining(['--input', 'input.json', '--export', 'custom', '--json']),
    expect.objectContaining({stdin: 'inherit'}),
  )
})

test.each(['9007199254740991', '9007199254740993', '0.12345678901234567890123456789', '1e400'])(
  'preserves native numeric tokens through validation and stdout: %s',
  async (number) => {
    const nativeJson = `{"name":"function.wasm","size":1,"memory_usage":64,"instructions":1000,"logs":"",
"input":{"nested":[${number}]},"output":{"nested":{"value":${number}}},
"extra_native_field":${number},"success":true}`
    vi.mocked(captureOutputWithExitCode).mockResolvedValue({stdout: nativeJson, stderr: '', exitCode: 0})
    const instance = await command(['--json', '--no-input'])
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runWithCommandEventsForCommand(instance.argv, () => instance.run())
      expect(stdout()).toBe(`${nativeJson}\n`)
      expect(stderr()).toBe('')
    })
  },
)

test.each([{argv: ['--json']}, {argv: []}])(
  'keeps target selection interactive independently of JSON: $argv',
  async ({argv}) => {
    vi.mocked(terminalSupportsPrompting).mockReturnValue(true)
    vi.mocked(renderAutocompletePrompt).mockResolvedValue('second')
    vi.mocked(captureOutputWithExitCode).mockResolvedValue({
      stdout: JSON.stringify(nativeResult),
      stderr: '',
      exitCode: 0,
    })
    const instance = await command(argv, [
      {target: 'first', export: 'first'},
      {target: 'second', export: 'second'},
    ])
    await runWithCommandEventsForCommand(argv, () => instance.run())
    expect(renderAutocompletePrompt).toHaveBeenCalledOnce()
    expect(captureOutputWithExitCode).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(['--export', 'second']),
      expect.any(Object),
    )
  },
)

test.each([
  {argv: ['--json'], promptable: false, stdoutInteractive: true, expectedExport: 'first'},
  {argv: [], promptable: false, stdoutInteractive: true, expectedExport: 'first'},
  {argv: ['--json'], promptable: true, stdoutInteractive: false, expectedExport: 'second'},
  {argv: [], promptable: true, stdoutInteractive: false, expectedExport: 'second'},
])(
  'selects the correct target with redirected streams: %j',
  async ({argv, promptable, stdoutInteractive, expectedExport}) => {
    vi.mocked(terminalSupportsPrompting).mockReturnValue(promptable)
    vi.mocked(isTerminalInteractive).mockReturnValue(stdoutInteractive)
    vi.mocked(renderAutocompletePrompt).mockResolvedValue('second')
    vi.mocked(captureOutputWithExitCode).mockResolvedValue({
      stdout: JSON.stringify(nativeResult),
      stderr: '',
      exitCode: 0,
    })
    const instance = await command(argv, [
      {target: 'first', export: 'first'},
      {target: 'second', export: 'second'},
    ])
    await runWithCommandEventsForCommand(argv, () => instance.run())
    expect(renderAutocompletePrompt).toHaveBeenCalledTimes(Number(promptable))
    expect(captureOutputWithExitCode).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(['--export', expectedExport]),
      expect.objectContaining({stdin: 'inherit'}),
    )
  },
)

test.each([{argv: ['--json', '--no-input']}, {argv: ['--no-input']}])(
  'does not prompt with --no-input: $argv',
  async ({argv}) => {
    vi.mocked(terminalSupportsPrompting).mockReturnValue(true)
    vi.mocked(captureOutputWithExitCode).mockResolvedValue({
      stdout: JSON.stringify(nativeResult),
      stderr: '',
      exitCode: 0,
    })
    const instance = await command(argv, [
      {target: 'first', export: 'first'},
      {target: 'second', export: 'second'},
    ])
    await runWithCommandEventsForCommand(argv, () => instance.run())
    expect(renderAutocompletePrompt).not.toHaveBeenCalled()
  },
)

test.runIf(process.platform !== 'win32').each([
  {failure: 'EACCES', json: false},
  {failure: 'EACCES', json: true},
  {failure: 'SIGTERM', json: false},
  {failure: 'SIGTERM', json: true},
])('rejects actual runner $failure failures with json=$json', async ({failure, json}) => {
  await inTemporaryDirectory(async (directory) => {
    const runner = joinPath(directory, 'runner')
    await writeFile(runner, '#!/bin/sh\nexit 0\n')
    await chmod(runner, 0o644)
    const {captureOutputWithExitCode: actualCapture} =
      await vi.importActual<typeof import('@shopify/cli-kit/node/system')>('@shopify/cli-kit/node/system')
    vi.mocked(captureOutputWithExitCode).mockImplementation((_command, _args, options) =>
      actualCapture(
        failure === 'EACCES' ? runner : process.execPath,
        failure === 'EACCES' ? [] : ['-e', "process.kill(process.pid, 'SIGTERM')"],
        {...options, cwd: directory},
      ),
    )
    const argv = [...(json ? ['--json'] : []), '--no-input']
    const instance = await command(argv)
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await expect(runWithCommandEventsForCommand(argv, () => instance.run())).rejects.toThrow(failure)
      expect(stdout()).toBe('')
      expect(stderr()).toBe('')
    })
  })
})

const runnerText = '\u001b[32mOutput\u001b[0m\n{"operations":[]}\nBenchmark Results\n'
const runnerStderr = 'Runner diagnostic\n'

describeJsonCommand({
  command: FunctionRun,
  commandId: 'app:function:run',
  moduleURL: new URL('../../../../../../cli/bin/dev.js', import.meta.url).href,
  args: [],
  expectedResult: nativeResult,
  expectedSchema: {
    type: 'object',
    additionalProperties: true,
    required: expect.arrayContaining(['name', 'size', 'memory_usage', 'instructions', 'logs', 'success']),
  },
  setup: async () => {
    await command([])
    vi.mocked(captureOutputWithExitCode).mockImplementation(async (_command, args, options) => {
      if (args.includes('--json')) return {stdout: JSON.stringify(nativeResult, null, 2), stderr: '', exitCode: 0}
      if (options?.stdout && options.stdout !== 'inherit') options.stdout.write(runnerText)
      if (options?.stderr && options.stderr !== 'inherit') options.stderr.write(runnerStderr)
      return {stdout: runnerText, stderr: runnerStderr, exitCode: 0}
    })
  },
  assertExecuted: (format) => {
    expect(localAppContext).toHaveBeenCalledExactlyOnceWith({directory: cwd(), userProvidedConfigName: undefined})
    expect(captureOutputWithExitCode).toHaveBeenCalledExactlyOnceWith(
      functionRunnerBinary().path,
      expect.arrayContaining(['--export', 'run', ...(format === 'json' ? ['--json'] : [])]),
      expect.objectContaining({stdin: 'inherit'}),
    )
    if (format === 'text') {
      expect(captureOutputWithExitCode).toHaveBeenCalledWith(
        expect.any(String),
        expect.not.arrayContaining(['--json']),
        expect.anything(),
      )
    }
    expect(renderAutocompletePrompt).not.toHaveBeenCalled()
    expect(exec).not.toHaveBeenCalled()
  },
  assertNotExecuted: () => {
    expect(localAppContext).not.toHaveBeenCalled()
    expect(captureOutputWithExitCode).not.toHaveBeenCalled()
  },
  textOutput: {stdout: runnerText, stderr: runnerStderr},
  diagnostics: {
    setup: () => {
      vi.mocked(captureOutputWithExitCode).mockResolvedValue({
        stdout: JSON.stringify(nativeResult, null, 2),
        stderr: 'Runner warning',
        exitCode: 0,
      })
    },
    expectedEvents: [{type: 'diagnostic', level: 'warning', message: 'Runner warning'}],
  },
  failure: {
    setup: () => {
      vi.mocked(captureOutputWithExitCode).mockResolvedValue({stdout: '', stderr: 'Invalid WASM', exitCode: 1})
    },
    expectedError: {
      error: {
        type: 'external',
        message: 'Function runner failed with exit code 1.',
        command: functionRunnerBinary().path,
        args: expect.arrayContaining(['--export', 'run', '--json']),
        details: {exitCode: 1, stderr: 'Invalid WASM'},
      },
    },
    exitCode: 1,
  },
})
