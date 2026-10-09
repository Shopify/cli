import FunctionReplay from './replay.js'
import {chooseFunction} from '../../../services/function/common.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {testAppLinked, testFunctionExtension} from '../../../models/app/app.test-data.js'
import {renderReplay} from '../../../services/function/ui.js'
import {selectFunctionRunPrompt} from '../../../prompts/function/replay.js'
import {functionRunJsonOutputSchema} from '../../../services/function/runner/types.js'
import {Config} from '@oclif/core'
import {afterEach, expect, test, vi} from 'vitest'
import {captureOutputWithExitCode, exec, terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
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

test('replays a saved log through the real native encoder and output writer', async () => {
  await inTemporaryDirectory(async (directory) => {
    vi.mocked(captureOutputWithExitCode).mockResolvedValue({
      stdout: JSON.stringify(nativeResult),
      stderr: 'Runner warning',
      exitCode: 0,
    })
    const instance = await command(['--json', '--no-watch', '--log', 'abcdef'], directory)
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runWithCommandEventsForCommand(instance.argv, () => instance.run())
      expect(JSON.parse(stdout())).toEqual(nativeResult)
      expect(JSON.parse(stderr())).toMatchObject({type: 'diagnostic', message: 'Runner warning'})
    })
    expect(captureOutputWithExitCode).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(['--json', '--export', 'run']),
      expect.objectContaining({input: JSON.stringify(nativeResult.input)}),
    )
    expect(renderReplay).not.toHaveBeenCalled()
    expect(selectFunctionRunPrompt).not.toHaveBeenCalled()
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

test('keeps finite text replay on the original runner output path', async () => {
  await inTemporaryDirectory(async (directory) => {
    const instance = await command(['--no-watch', '--log', 'abcdef'], directory)
    await instance.run()
    expect(exec).toHaveBeenCalledWith(
      expect.any(String),
      expect.not.arrayContaining(['--json']),
      expect.objectContaining({stdout: 'inherit', stderr: 'inherit'}),
    )
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

test('shares the native runner schema and preserves synchronous analytics', () => {
  expect(FunctionReplay.jsonOutputSchema).toBe(functionRunJsonOutputSchema)
  expect(FunctionReplay.descriptionForHelp()).toContain('FunctionRunResult')
  expect(FunctionReplay.requiresSyncAnalytics).toBe(true)
})
