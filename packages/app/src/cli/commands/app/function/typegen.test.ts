import FunctionTypegen from './typegen.js'
import {chooseFunction} from '../../../services/function/common.js'
import {localAppContext} from '../../../services/app-context.js'
import {testApp, testFunctionExtension, testProject} from '../../../models/app/app.test-data.js'
import {functionTypegenJsonOutputSchema} from '../../../services/function/typegen/types.js'
import {Config} from '@oclif/core'
import {afterEach, expect, test, vi} from 'vitest'
import {inTemporaryDirectory, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {ExternalError, AbortError, handler} from '@shopify/cli-kit/node/error'
import {exec} from '@shopify/cli-kit/node/system'
import {packageManagerBinaryCommandForDirectory} from '@shopify/cli-kit/node/node-package-manager'
import {unstyled} from '@shopify/cli-kit/node/output'

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
  {custom: true, noInput: true},
  {custom: true, noInput: false},
  {custom: false, noInput: true},
  {custom: false, noInput: false},
])('emits one result and codegen side events: %j', async ({custom, noInput}) => {
  await inTemporaryDirectory(async (directory) => {
    const argv = ['--json', ...(noInput ? ['--no-input'] : [])]
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
        function: {handle: extension.configuration.handle ?? null, name: extension.name, directory},
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

test.each([[], ['--no-input']])('keeps custom codegen text output and the success banner: %j', async (...argv) => {
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

test('emits one fatal document when the custom generator fails', async () => {
  vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
  await inTemporaryDirectory(async (directory) => {
    const {instance} = await command(['--json'], directory, true)
    vi.mocked(exec).mockRejectedValue(new ExternalError('Generator failed', 'custom-codegen', []))
    await withCapturedStandardStreams(async ({stdout}) => {
      await runWithCommandEventsForCommand(instance.argv, async () => {
        try {
          await instance.run()
          expect.unreachable('Expected typegen to fail')
        } catch (error) {
          if (!(error instanceof ExternalError)) throw error
          await handler(error)
        }
      })
      expect(JSON.parse(stdout())).toMatchObject({error: {type: 'external', message: 'Generator failed'}})
      expect(stdout()).not.toContain('"status":"success"')
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

test('exposes the result schema and retains inherited flags', () => {
  expect(FunctionTypegen.flags.json).toBeDefined()
  expect(FunctionTypegen.flags['no-input']).toBeDefined()
  expect(FunctionTypegen.jsonOutputSchema).toBe(functionTypegenJsonOutputSchema)
  expect(FunctionTypegen.descriptionForHelp()).toContain('FunctionTypegenResult')
})
