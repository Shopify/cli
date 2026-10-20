import FunctionBuild from './build.js'
import {chooseFunction} from '../../../services/function/common.js'
import {buildFunctionExtension} from '../../../services/build/extension.js'
import {localAppContext} from '../../../services/app-context.js'
import {testApp, testFunctionExtension, testProject} from '../../../models/app/app.test-data.js'
import {
  functionBuildJsonOutputSchema,
  type FunctionBuildResult,
} from '../../../services/function/build-command/types.js'
import {Config} from '@oclif/core'
import {afterEach, expect, test, vi} from 'vitest'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {AbortError, handler} from '@shopify/cli-kit/node/error'
import {unstyled} from '@shopify/cli-kit/node/output'
import {exec} from '@shopify/cli-kit/node/system'

// eslint-disable-next-line no-restricted-imports
import {resolve} from 'node:path'

vi.mock('../../../services/app-context.js')
vi.mock('../../../services/build/extension.js')
vi.mock('../../../services/function/common.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/function/common.js')>()),
  chooseFunction: vi.fn(),
}))

afterEach(() => vi.unstubAllEnvs())

async function command(argv: string[], directory: string) {
  const app = testApp({directory})
  const extension = await testFunctionExtension({dir: directory})
  vi.mocked(localAppContext).mockResolvedValue({app, project: testProject(), activeConfig: {} as never})
  vi.mocked(chooseFunction).mockResolvedValue(extension)
  const result: FunctionBuildResult = {
    status: 'success',
    function: {
      handle: extension.configuration.handle ?? null,
      name: extension.name,
      directory: resolve(directory),
      wasmPath: null,
    },
  }
  vi.mocked(buildFunctionExtension).mockResolvedValue(result)
  return {instance: new FunctionBuild(argv, await Config.load()), extension, app, result}
}

test.each([['--json'], ['--json', '--no-input'], ['-j'], ['-jcstaging'], ['-cstaging', '-j']])(
  'writes one result and structured build diagnostics: %j',
  async (...argv) => {
    await inTemporaryDirectory(async (directory) => {
      const {instance, extension, app, result} = await command(argv, directory)
      vi.mocked(buildFunctionExtension).mockImplementation(async (_extension, options) => {
        await exec(process.execPath, ['-e', 'console.log("Compiler output"); console.error("Compiler warning")'], {
          stdout: options.stdout,
          stderr: options.stderr,
        })
        return {...result, function: {...result.function, wasmPath: resolve(extension.outputPath)}}
      })
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        const result = await runWithCommandEventsForCommand(argv, () => instance.run())
        expect(result).toEqual({app})
        expect(JSON.parse(stdout())).toEqual({
          status: 'success',
          function: {
            handle: extension.configuration.handle ?? null,
            name: extension.name,
            directory: resolve(directory),
            wasmPath: resolve(directory, 'dist/index.wasm'),
          },
        })
        const events = stderr()
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line))
        expect(events).toEqual(
          expect.arrayContaining([
            expect.objectContaining({type: 'diagnostic', message: expect.stringContaining('Compiler output')}),
            expect.objectContaining({type: 'diagnostic', message: expect.stringContaining('Compiler warning')}),
          ]),
        )
        expect(stderr()).not.toContain('Function built successfully.')
      })
    })
  },
)

test('reports an absent Wasm artifact as null', async () => {
  await inTemporaryDirectory(async (directory) => {
    const {instance} = await command(['--json'], directory)
    await withCapturedStandardStreams(async ({stdout}) => {
      await runWithCommandEventsForCommand(instance.argv, () => instance.run())
      expect(JSON.parse(stdout()).function.wasmPath).toBeNull()
    })
  })
})

test.each([[], ['--no-input']])('keeps native build output and the text success banner: %j', async (...argv) => {
  await inTemporaryDirectory(async (directory) => {
    const {instance, result} = await command(argv, directory)
    vi.mocked(buildFunctionExtension).mockImplementation(async (_extension, options) => {
      options.stdout.write('Native build output\n')
      options.stderr.write('Native build warning\n')
      return result
    })
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await instance.run()
      expect(stdout()).toBe('Native build output\n')
      expect(unstyled(stderr())).toContain('Native build warning')
      expect(unstyled(stderr())).toContain('Function built successfully.')
    })
  })
})

test.each(['Compiler failed', 'Failed to build function.'])(
  'writes a fatal document for failed builds: %s',
  async (message) => {
    vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
    await inTemporaryDirectory(async (directory) => {
      const {instance} = await command(['--json'], directory)
      vi.mocked(buildFunctionExtension).mockRejectedValue(new AbortError(message))
      await withCapturedStandardStreams(async ({stdout}) => {
        await runWithCommandEventsForCommand(instance.argv, async () => {
          try {
            await instance.run()
          } catch (failure) {
            if (!(failure instanceof AbortError)) throw failure
            await handler(failure)
          }
        })
        expect(JSON.parse(stdout())).toEqual({error: {type: 'abort', message}})
        expect(stdout()).not.toContain('"status":"success"')
      })
    })
  },
)

test('exposes the schema, JSON flag and inherited flags', () => {
  expect(FunctionBuild.flags.json).toBeDefined()
  expect(FunctionBuild.flags['no-input']).toBeDefined()
  expect(FunctionBuild.jsonOutputSchema).toBe(functionBuildJsonOutputSchema)
  expect(FunctionBuild.descriptionForHelp()).toContain('FunctionBuildResult')
})
