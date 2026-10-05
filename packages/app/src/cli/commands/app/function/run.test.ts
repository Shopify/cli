import FunctionRun from './run.js'
import {chooseFunction} from '../../../services/function/common.js'
import {localAppContext} from '../../../services/app-context.js'
import {testApp, testFunctionExtension, testProject} from '../../../models/app/app.test-data.js'
import {functionRunJsonOutputSchema} from '../../../services/function/runner/types.js'
import {Config} from '@oclif/core'
import {afterEach, expect, test, vi} from 'vitest'
import {captureOutputWithExitCode, exec} from '@shopify/cli-kit/node/system'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {renderAutocompletePrompt} from '@shopify/cli-kit/node/ui'
import {isTerminalInteractive} from '@shopify/cli-kit/node/context/local'
import {ExternalError, handler} from '@shopify/cli-kit/node/error'

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
  vi.mocked(localAppContext).mockResolvedValue({app: testApp(), project: testProject()})
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

test.each([{argv: ['--json']}, {argv: []}])(
  'keeps target selection interactive independently of JSON: $argv',
  async ({argv}) => {
    vi.mocked(isTerminalInteractive).mockReturnValue(true)
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
    const runner = argv.includes('--json') ? captureOutputWithExitCode : exec
    expect(runner).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(['--export', 'second']),
      expect.any(Object),
    )
  },
)

test.each([{argv: ['--json', '--no-input']}, {argv: ['--no-input']}])(
  'does not prompt with --no-input: $argv',
  async ({argv}) => {
    vi.mocked(isTerminalInteractive).mockReturnValue(true)
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

test('retains the existing runner text presentation', async () => {
  const instance = await command([])
  await instance.run()
  expect(captureOutputWithExitCode).not.toHaveBeenCalled()
  expect(exec).toHaveBeenCalledWith(
    expect.any(String),
    expect.not.arrayContaining(['--json']),
    expect.objectContaining({stdout: 'inherit', stderr: 'inherit'}),
  )
})

test('prints a single standard fatal document for an infrastructure failure', async () => {
  vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
  vi.mocked(captureOutputWithExitCode).mockResolvedValue({stdout: '', stderr: 'Invalid WASM', exitCode: 1})
  const instance = await command(['--json'])
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await runWithCommandEventsForCommand(['--json'], async () => {
      try {
        await instance.run()
        expect.unreachable('The command should fail')
      } catch (error) {
        if (!(error instanceof ExternalError)) throw error
        await handler(error)
      }
    })
    expect(JSON.parse(stdout())).toMatchObject({
      error: {type: 'external', details: {exitCode: 1, stderr: 'Invalid WASM'}},
    })
    expect(stderr()).toBe('')
  })
})

test('exposes the native schema in help', () => {
  expect(FunctionRun.jsonOutputSchema).toBe(functionRunJsonOutputSchema)
  expect(FunctionRun.descriptionForHelp()).toContain('FunctionRunResult')
})
