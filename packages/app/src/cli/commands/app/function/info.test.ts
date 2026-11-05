import FunctionInfo from './info.js'
import {chooseFunction, getOrGenerateSchemaPath} from '../../../services/function/common.js'
import {downloadBinary, functionRunnerBinary} from '../../../services/function/binaries.js'
import {localAppContext} from '../../../services/app-context.js'
import {functionInfoJsonOutputSchema} from '../../../services/function/info/types.js'
import {testApp, testFunctionExtension, testProject} from '../../../models/app/app.test-data.js'
import {Config} from '@oclif/core'
import {expect, test, vi} from 'vitest'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {describeJsonCommand} from '@shopify/cli-kit/node/testing/json-command'
import {AbortError} from '@shopify/cli-kit/node/error'
import {cwd, joinPath} from '@shopify/cli-kit/node/path'
// eslint-disable-next-line no-restricted-imports
import {resolve} from 'node:path'

vi.mock('../../../services/app-context.js')
vi.mock('../../../services/function/common.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/function/common.js')>()),
  chooseFunction: vi.fn(),
  getOrGenerateSchemaPath: vi.fn(),
}))
vi.mock('../../../services/function/binaries.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/function/binaries.js')>()),
  downloadBinary: vi.fn(),
}))

async function runCommand(argv: string[]) {
  const app = testApp()
  vi.mocked(localAppContext).mockResolvedValue({app, project: testProject(), activeConfig: {} as never})
  vi.mocked(chooseFunction).mockResolvedValue(await testFunctionExtension())
  vi.mocked(getOrGenerateSchemaPath).mockResolvedValue(undefined)
  const command = new FunctionInfo(argv, await Config.load())
  return runWithCommandEventsForCommand(argv, () => command.run())
}

test.each([{argv: ['--json']}])('writes a typed result without changing input policy: %j', async ({argv}) => {
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await runCommand(argv)
    expect(functionInfoJsonOutputSchema.validate(JSON.parse(stdout())).function.schemaPath).toBeNull()
    expect(stderr()).toBe('')
    expect(chooseFunction).toHaveBeenCalledOnce()
    expect(downloadBinary).toHaveBeenCalledOnce()
  })
})

test('propagates setup failure without printing a result', async () => {
  vi.mocked(downloadBinary).mockRejectedValue(new Error('Download failed'))
  await withCapturedStandardStreams(async ({stdout}) => {
    await expect(runCommand(['--json'])).rejects.toThrow('Download failed')
    expect(stdout()).toBe('')
  })
})

const infoDirectory = '/tmp/project/extensions/my-function'
const infoTarget = 'purchase.product-discount.run'
let infoApp: ReturnType<typeof testApp>
let infoExtension: Awaited<ReturnType<typeof testFunctionExtension>>

describeJsonCommand({
  command: FunctionInfo,
  commandId: 'app:function:info',
  moduleURL: new URL('../../../../../../cli/bin/dev.js', import.meta.url).href,
  args: [],
  expectedResult: () => ({
    function: {
      handle: null,
      name: 'test function extension',
      apiVersion: '2022-07',
      directory: resolve(infoDirectory),
      targets: [{target: infoTarget, inputQueryPath: resolve(infoDirectory, 'src/run.graphql'), export: 'run'}],
      schemaPath: resolve(infoDirectory, 'schema.graphql'),
      wasmPath: resolve(infoDirectory, 'dist/index.wasm'),
      functionRunnerPath: resolve(functionRunnerBinary().path),
    },
  }),
  expectedSchema: {
    type: 'object',
    required: ['function'],
    additionalProperties: false,
    properties: {function: {$ref: '#/definitions/FunctionInfo'}},
  },
  setup: async () => {
    infoApp = testApp()
    infoExtension = await testFunctionExtension({dir: infoDirectory})
    infoExtension.configuration.targeting = [{target: infoTarget, input_query: 'src/run.graphql', export: 'run'}]
    vi.mocked(localAppContext).mockResolvedValue({app: infoApp, project: testProject(), activeConfig: {} as never})
    vi.mocked(chooseFunction).mockResolvedValue(infoExtension)
    vi.mocked(getOrGenerateSchemaPath).mockResolvedValue(joinPath(infoDirectory, 'schema.graphql'))
  },
  assertExecuted: () => {
    expect(localAppContext).toHaveBeenCalledExactlyOnceWith({directory: cwd(), userProvidedConfigName: undefined})
    expect(chooseFunction).toHaveBeenCalledExactlyOnceWith(infoApp, cwd())
    expect(downloadBinary).toHaveBeenCalledOnce()
    expect(getOrGenerateSchemaPath).toHaveBeenCalledOnce()
  },
  assertNotExecuted: () => {
    expect(localAppContext).not.toHaveBeenCalled()
    expect(downloadBinary).not.toHaveBeenCalled()
    expect(getOrGenerateSchemaPath).not.toHaveBeenCalled()
  },
  textOutput: ({stdout, stderr}) => {
    expect(stdout).toBe('')
    expect(stderr).toContain('CONFIGURATION')
    expect(stderr).toContain('test function extension')
    expect(stderr).toContain(infoTarget)
    expect(stderr).toContain('FUNCTION RUNNER')
  },
  diagnostics: {
    setup: () => {
      vi.mocked(downloadBinary).mockImplementation(async () => {
        outputInfo('Preparing Function runner')
      })
    },
    expectedEvents: [{type: 'diagnostic', level: 'info', message: 'Preparing Function runner'}],
  },
  failure: {
    setup: () => {
      vi.mocked(getOrGenerateSchemaPath).mockRejectedValue(
        new AbortError('A schema could not be generated for test-function-extension'),
      )
    },
    expectedError: {error: {type: 'abort', message: 'A schema could not be generated for test-function-extension'}},
    exitCode: 1,
  },
})
