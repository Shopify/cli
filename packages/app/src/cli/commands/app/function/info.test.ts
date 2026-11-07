import FunctionInfo from './info.js'
import {chooseFunction, getOrGenerateSchemaPath} from '../../../services/function/common.js'
import {downloadBinary} from '../../../services/function/binaries.js'
import {localAppContext} from '../../../services/app-context.js'
import {functionInfoJsonOutputSchema} from '../../../services/function/info/types.js'
import {testApp, testFunctionExtension, testProject} from '../../../models/app/app.test-data.js'
import {Config} from '@oclif/core'
import {expect, test, vi} from 'vitest'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {outputInfo} from '@shopify/cli-kit/node/output'

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

test.each([{argv: ['--json']}, {argv: ['--json', '--no-input']}])(
  'writes a typed result without changing input policy: %j',
  async ({argv}) => {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runCommand(argv)
      expect(functionInfoJsonOutputSchema.validate(JSON.parse(stdout())).function.schemaPath).toBeNull()
      expect(stderr()).toBe('')
      expect(chooseFunction).toHaveBeenCalledOnce()
      expect(downloadBinary).toHaveBeenCalledOnce()
    })
  },
)

test.each([{argv: []}, {argv: ['--no-input']}])('preserves text output: %j', async ({argv}) => {
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await runCommand(argv)
    expect(stdout()).toBe('')
    expect(stderr()).toContain('CONFIGURATION')
  })
})

test('routes setup diagnostics to stderr as events', async () => {
  vi.mocked(downloadBinary).mockImplementation(async () => {
    outputInfo('Preparing Function runner')
  })
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await runCommand(['--json'])
    expect(JSON.parse(stdout())).toHaveProperty('function')
    expect(JSON.parse(stderr())).toMatchObject({type: 'diagnostic', message: 'Preparing Function runner'})
  })
})

test('propagates setup failure without printing a result', async () => {
  vi.mocked(downloadBinary).mockRejectedValue(new Error('Download failed'))
  await withCapturedStandardStreams(async ({stdout}) => {
    await expect(runCommand(['--json'])).rejects.toThrow('Download failed')
    expect(stdout()).toBe('')
  })
})

test('exposes the result schema in help', () => {
  expect(FunctionInfo.jsonOutputSchema).toBe(functionInfoJsonOutputSchema)
  expect(FunctionInfo.descriptionForHelp()).toContain('FunctionInfoResult')
})
