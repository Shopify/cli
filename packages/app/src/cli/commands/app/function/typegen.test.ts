import FunctionTypegen from './typegen.js'
import {chooseFunction} from '../../../services/function/common.js'
import {localAppContext} from '../../../services/app-context.js'
import {testApp, testFunctionExtension, testProject} from '../../../models/app/app.test-data.js'
import {Config} from '@oclif/core'
import {afterEach, expect, test, vi} from 'vitest'
import {inTemporaryDirectory, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {cwd, joinPath} from '@shopify/cli-kit/node/path'
import {describeJsonCommand} from '@shopify/cli-kit/node/testing/json-command'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {ExternalError, AbortError} from '@shopify/cli-kit/node/error'
import {exec} from '@shopify/cli-kit/node/system'
import {packageManagerBinaryCommandForDirectory} from '@shopify/cli-kit/node/node-package-manager'
import {unstyled} from '@shopify/cli-kit/node/output'

// eslint-disable-next-line no-restricted-imports
import {resolve} from 'node:path'

vi.mock('../../../services/app-context.js')
vi.mock('@shopify/cli-kit/node/system', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/system')>()),
  exec: vi.fn(),
}))
vi.mock('@shopify/cli-kit/node/node-package-manager', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/node-package-manager')>()),
  packageManagerBinaryCommandForDirectory: vi.fn(),
}))
vi.mock('../../../services/function/common.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/function/common.js')>()),
  chooseFunction: vi.fn(),
}))
afterEach(() => vi.unstubAllEnvs())

async function command(argv: string[], directory: string, custom = false) {
  const app = testApp({directory})
  const extension = await testFunctionExtension({dir: directory, entryPath: 'src/index.js'})
  if (custom) extension.configuration.build!.typegen_command = 'custom-codegen --target test'
  vi.mocked(localAppContext).mockResolvedValue({app, project: testProject(), activeConfig: {} as never})
  vi.mocked(chooseFunction).mockResolvedValue(extension)
  vi.mocked(packageManagerBinaryCommandForDirectory).mockResolvedValue({
    command: 'codegen',
    args: ['--config', 'package.json'],
  })
  return {instance: new FunctionTypegen(argv, await Config.load()), extension, app}
}

test.each([
  {custom: false, argv: ['--json']},
  {custom: true, argv: ['-jcstaging']},
  {custom: false, argv: ['-jcstaging']},
])('emits one result and codegen side events: %j', async ({custom, argv}) => {
  await inTemporaryDirectory(async (directory) => {
    const {instance, extension, app} = await command(argv, directory, custom)
    vi.mocked(exec).mockImplementation(async (_command, _args, options) => {
      if (options?.stdout && options.stdout !== 'inherit') options.stdout.write('Generating types\n')
      if (options?.stderr && options.stderr !== 'inherit') options.stderr.write('Codegen warning\n')
      await writeFile(joinPath(directory, 'generated.ts'), 'export type Input = {}\n')
    })
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await expect(runWithCommandEventsForCommand(argv, () => instance.run())).resolves.toEqual({app})
      expect(JSON.parse(stdout())).toEqual({
        status: 'success',
        function: {handle: extension.configuration.handle ?? null, name: extension.name, directory: resolve(directory)},
      })
      const events = stderr()
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
      expect(events).toContainEqual(
        expect.objectContaining({type: 'diagnostic', message: expect.stringContaining('Codegen warning')}),
      )
      if (custom)
        expect(events).toContainEqual(
          expect.objectContaining({type: 'diagnostic', message: expect.stringContaining('Generating types')}),
        )
      expect(stderr()).not.toContain('GraphQL types generated successfully.')
    })
    await expect(readFile(joinPath(directory, 'generated.ts'))).resolves.toBe('export type Input = {}\n')
    expect(exec).toHaveBeenCalledWith(
      custom ? 'custom-codegen' : 'codegen',
      custom ? ['--target', 'test'] : ['--config', 'package.json'],
      expect.objectContaining({cwd: directory}),
    )
  })
})

test.each([[]])('keeps custom codegen text output and the success banner: %j', async (...argv) => {
  await inTemporaryDirectory(async (directory) => {
    const {instance} = await command(argv, directory, true)
    vi.mocked(exec).mockImplementation(async (_command, _args, options) => {
      if (options?.stdout && options.stdout !== 'inherit') options.stdout.write('Native codegen output\n')
    })
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await instance.run()
      expect(stdout()).toBe('Native codegen output\n')
      expect(unstyled(stderr())).toContain('GraphQL types generated successfully.')
    })
  })
})

test('keeps the missing custom generator error for non-JavaScript functions', async () => {
  await inTemporaryDirectory(async (directory) => {
    const {instance, extension} = await command(['--json'], directory)
    extension.entrySourceFilePath = 'src/main.rs'
    await withCapturedStandardStreams(async ({stdout}) => {
      await expect(runWithCommandEventsForCommand(instance.argv, () => instance.run())).rejects.toThrow(AbortError)
      expect(stdout()).toBe('')
    })
    expect(exec).not.toHaveBeenCalled()
  })
})

const concurrentTitle = 'Running concurrent processes'
const typegenDirectory = '/tmp/project/extensions/my-function'
let typegenApp: ReturnType<typeof testApp>
let typegenExtension: Awaited<ReturnType<typeof testFunctionExtension>>

describeJsonCommand({
  command: FunctionTypegen,
  commandId: 'app:function:typegen',
  moduleURL: new URL('../../../../../../cli/bin/dev.js', import.meta.url).href,
  args: [],
  expectedResult: {
    status: 'success',
    function: {handle: null, name: 'test function extension', directory: resolve(typegenDirectory)},
  },
  expectedEvents: [
    {type: 'progress', status: 'started', message: concurrentTitle},
    {type: 'progress', status: 'completed', message: concurrentTitle, current: 1, total: 1},
  ],
  expectedSchema: {
    type: 'object',
    required: ['status', 'function'],
    additionalProperties: false,
    properties: {function: {$ref: '#/definitions/Function'}},
  },
  setup: async () => {
    typegenApp = testApp()
    typegenExtension = await testFunctionExtension({dir: typegenDirectory})
    typegenExtension.configuration.build!.typegen_command = 'custom-codegen --target test'
    vi.mocked(localAppContext).mockResolvedValue({app: typegenApp, project: testProject(), activeConfig: {} as never})
    vi.mocked(chooseFunction).mockResolvedValue(typegenExtension)
    vi.mocked(exec).mockResolvedValue(undefined)
  },
  assertExecuted: () => {
    expect(localAppContext).toHaveBeenCalledExactlyOnceWith({directory: cwd(), userProvidedConfigName: undefined})
    expect(chooseFunction).toHaveBeenCalledExactlyOnceWith(typegenApp, cwd())
    expect(exec).toHaveBeenCalledExactlyOnceWith(
      'custom-codegen',
      ['--target', 'test'],
      expect.objectContaining({cwd: typegenDirectory}),
    )
    expect(packageManagerBinaryCommandForDirectory).not.toHaveBeenCalled()
  },
  assertNotExecuted: () => {
    expect(localAppContext).not.toHaveBeenCalled()
    expect(exec).not.toHaveBeenCalled()
  },
  textOutput: ({stdout, stderr}) => {
    expect(stdout).toBe('')
    expect(stderr).toContain('GraphQL types generated successfully.')
  },
  diagnostics: {
    setup: () => {
      vi.mocked(exec).mockImplementation(async (_command, _args, options) => {
        if (options?.stdout && options.stdout !== 'inherit') options.stdout.write('Generating types\n')
        if (options?.stderr && options.stderr !== 'inherit') options.stderr.write('Codegen warning\n')
      })
    },
    expectedEvents: [
      {type: 'progress', status: 'started', message: concurrentTitle},
      {type: 'diagnostic', level: 'info', message: 'test-function-extension: Generating types'},
      {type: 'diagnostic', level: 'info', message: 'test-function-extension: Codegen warning'},
      {type: 'progress', status: 'completed', message: concurrentTitle, current: 1, total: 1},
    ],
  },
  failure: {
    setup: () => {
      vi.mocked(exec).mockRejectedValue(new ExternalError('Generator failed', 'custom-codegen', ['--target', 'test']))
    },
    expectedError: {
      error: {type: 'external', message: 'Generator failed', command: 'custom-codegen', args: ['--target', 'test']},
    },
    expectedEvents: [
      {type: 'progress', status: 'started', message: concurrentTitle},
      {type: 'progress', status: 'failed', message: concurrentTitle},
    ],
    exitCode: 1,
  },
})
