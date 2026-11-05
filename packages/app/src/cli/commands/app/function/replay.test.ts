import FunctionReplay from './replay.js'
import {chooseFunction} from '../../../services/function/common.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {testAppLinked, testFunctionExtension} from '../../../models/app/app.test-data.js'
import {renderReplay} from '../../../services/function/ui.js'
import {selectFunctionRunPrompt} from '../../../prompts/function/replay.js'
import {functionRunnerBinary} from '../../../services/function/binaries.js'
import {Config} from '@oclif/core'
import {afterEach, expect, test, vi} from 'vitest'
import {captureOutputWithExitCode, exec, terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {inTemporaryDirectory, mkdir, rmdir, tempDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {describeJsonCommand} from '@shopify/cli-kit/node/testing/json-command'
import {isTerminalInteractive} from '@shopify/cli-kit/node/context/local'

vi.mock('../../../services/app-context.js')
vi.mock('@shopify/cli-kit/node/system')
vi.mock('../../../services/function/ui.js')
vi.mock('../../../prompts/function/replay.js')
vi.mock('../../../services/function/common.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/function/common.js')>()),
  chooseFunction: vi.fn(),
}))
vi.mock('../../../services/function/binaries.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/function/binaries.js')>()),
  downloadBinary: vi.fn(),
}))
vi.mock('@shopify/cli-kit/node/context/local', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/context/local')>()),
  isTerminalInteractive: vi.fn(),
}))

afterEach(() => vi.unstubAllEnvs())

const nativeResult = {
  name: 'function.wasm',
  size: 1,
  memory_usage: 64,
  instructions: 1000,
  logs: '',
  input: {native_key: true},
  output: {operations: []},
  success: true,
}

async function command(argv: string[], directory: string) {
  const app = testAppLinked({directory})
  const extension = await testFunctionExtension({dir: directory})
  vi.mocked(linkedAppContext).mockResolvedValue({app} as Awaited<ReturnType<typeof linkedAppContext>>)
  vi.mocked(chooseFunction).mockResolvedValue(extension)
  await mkdir(app.getLogsDir())
  await writeFile(
    joinPath(app.getLogsDir(), `20240522_150641_827Z_extensions_${extension.handle}_abcdef.json`),
    JSON.stringify({payload: {input: nativeResult.input, export: 'run'}}),
  )
  return new FunctionReplay(argv, await Config.load())
}

test('preserves native numeric tokens in finite replay output', async () => {
  await inTemporaryDirectory(async (directory) => {
    const nativeJson = `{"name":"function.wasm","size":1,"memory_usage":64,"instructions":1000,"logs":"",
"input":{"nested":[9007199254740993]},
"output":{"nested":[9007199254740993,0.12345678901234567890123456789]},"success":true}`
    vi.mocked(captureOutputWithExitCode).mockResolvedValue({stdout: nativeJson, stderr: '', exitCode: 0})
    const instance = await command(['--json', '--no-watch', '--log', 'abcdef'], directory)
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runWithCommandEventsForCommand(instance.argv, () => instance.run())
      expect(stdout()).toBe(`${nativeJson}\n`)
      expect(stderr()).toBe('')
    })
  })
})

test.each([{argv: ['--json', '--log', 'abcdef']}, {argv: ['--json', '--watch', '--log', 'abcdef']}])(
  'rejects JSON watch mode before linking the app: $argv',
  async ({argv}) => {
    const instance = new FunctionReplay(argv, await Config.load())
    await withCapturedStandardStreams(async ({stdout}) => {
      await expect(instance.run()).rejects.toThrow('Use --no-watch with --json')
      expect(stdout()).toBe('')
    })
    expect(linkedAppContext).not.toHaveBeenCalled()
  },
)

test('keeps the default text watch workflow', async () => {
  await inTemporaryDirectory(async (directory) => {
    const instance = await command(['--log', 'abcdef'], directory)
    await instance.run()
    expect(renderReplay).toHaveBeenCalledOnce()
    expect(captureOutputWithExitCode).not.toHaveBeenCalled()
  })
})

test('rejects a missing saved log without writing a result', async () => {
  await inTemporaryDirectory(async (directory) => {
    const instance = await command(['--json', '--no-watch', '--log', 'missing'], directory)
    await withCapturedStandardStreams(async ({stdout}) => {
      await expect(instance.run()).rejects.toThrow('No log found')
      expect(stdout()).toBe('')
    })
    expect(captureOutputWithExitCode).not.toHaveBeenCalled()
  })
})

test('allows JSON replay to select a log interactively', async () => {
  await inTemporaryDirectory(async (directory) => {
    vi.mocked(isTerminalInteractive).mockReturnValue(true)
    vi.mocked(terminalSupportsPrompting).mockReturnValue(true)
    vi.mocked(selectFunctionRunPrompt).mockImplementation(async (runs) => runs[0])
    vi.mocked(captureOutputWithExitCode).mockResolvedValue({
      stdout: JSON.stringify(nativeResult),
      stderr: '',
      exitCode: 0,
    })
    const instance = await command(['--json', '--no-watch'], directory)
    await runWithCommandEventsForCommand(instance.argv, () => instance.run())
    expect(selectFunctionRunPrompt).toHaveBeenCalledOnce()
  })
})

test('requires --log when --no-input is enabled', async () => {
  vi.stubEnv('SHOPIFY_FLAG_NO_INPUT', '1')
  const instance = new FunctionReplay(['--json', '--no-watch', '--no-input'], await Config.load())
  await expect(instance.run()).rejects.toThrow('log')
  expect(selectFunctionRunPrompt).not.toHaveBeenCalled()
})

test('preserves synchronous analytics', () => {
  expect(FunctionReplay.requiresSyncAnalytics).toBe(true)
})

const replayText = '  Function output:\n{ operations: [] }\n'
const replayStderr = 'Runner warning\n'
let replayDirectory: string
let replayApp: ReturnType<typeof testAppLinked>
let replayExtension: Awaited<ReturnType<typeof testFunctionExtension>>

describeJsonCommand({
  command: FunctionReplay,
  commandId: 'app:function:replay',
  moduleURL: new URL('../../../../../../cli/bin/dev.js', import.meta.url).href,
  args: () => ['--path', replayDirectory, '--no-watch', '--log', 'abcdef'],
  expectedResult: nativeResult,
  expectedSchema: {
    type: 'object',
    additionalProperties: true,
    required: expect.arrayContaining(['name', 'size', 'memory_usage', 'instructions', 'logs', 'success']),
  },
  setup: async () => {
    replayDirectory = tempDirectory()
    replayApp = testAppLinked({directory: replayDirectory})
    replayExtension = await testFunctionExtension({dir: replayDirectory})
    vi.mocked(linkedAppContext).mockResolvedValue({app: replayApp} as Awaited<ReturnType<typeof linkedAppContext>>)
    vi.mocked(chooseFunction).mockResolvedValue(replayExtension)
    await mkdir(replayApp.getLogsDir())
    await writeFile(
      joinPath(replayApp.getLogsDir(), `20240522_150641_827Z_extensions_${replayExtension.handle}_abcdef.json`),
      JSON.stringify({payload: {input: nativeResult.input, export: 'run'}}),
    )
    vi.mocked(captureOutputWithExitCode).mockImplementation(async (_command, args, options) => {
      if (args.includes('--json')) return {stdout: JSON.stringify(nativeResult, null, 2), stderr: '', exitCode: 0}
      if (options?.stderr && options.stderr !== 'inherit') options.stderr.write(replayStderr)
      if (options?.stdout && options.stdout !== 'inherit') options.stdout.write(replayText)
      return {stdout: replayText, stderr: replayStderr, exitCode: 0}
    })
    const directory = replayDirectory
    return () => rmdir(directory)
  },
  assertExecuted: (format) => {
    expect(linkedAppContext).toHaveBeenCalledExactlyOnceWith({
      directory: replayDirectory,
      clientId: undefined,
      forceRelink: false,
      userProvidedConfigName: undefined,
    })
    expect(chooseFunction).toHaveBeenCalledExactlyOnceWith(replayApp, replayDirectory)
    expect(captureOutputWithExitCode).toHaveBeenCalledExactlyOnceWith(
      functionRunnerBinary().path,
      expect.arrayContaining(['--export', 'run', ...(format === 'json' ? ['--json'] : [])]),
      expect.objectContaining({input: JSON.stringify(nativeResult.input)}),
    )
    if (format === 'text') {
      expect(captureOutputWithExitCode).toHaveBeenCalledWith(
        expect.any(String),
        expect.not.arrayContaining(['--json']),
        expect.anything(),
      )
    }
    expect(renderReplay).not.toHaveBeenCalled()
    expect(selectFunctionRunPrompt).not.toHaveBeenCalled()
    expect(exec).not.toHaveBeenCalled()
  },
  assertNotExecuted: () => {
    expect(linkedAppContext).not.toHaveBeenCalled()
    expect(captureOutputWithExitCode).not.toHaveBeenCalled()
  },
  textOutput: {stdout: replayText, stderr: replayStderr},
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
