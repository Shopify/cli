import ConfigUse from './use.js'
import {useAppConfiguration} from '../../../services/app/config/use.js'
import {appConfigUseJsonOutputSchema} from '../../../services/app/config/use/types.js'
import {localAppContext} from '../../../services/app-context.js'
import {testApp} from '../../../models/app/app.test-data.js'
import {checkFolderIsValidApp} from '../../../models/app/loader.js'
import {Config} from '@oclif/core'
import {expect, test, vi} from 'vitest'
import * as context from '@shopify/cli-kit/node/context/local'
import {mockAndCaptureStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {describeJsonCommand} from '@shopify/cli-kit/node/testing/json-command'
import {AbortError} from '@shopify/cli-kit/node/error'

vi.mock('../../../services/app/config/use.js')
vi.mock('../../../services/app-context.js')
vi.mock('../../../models/app/loader.js')
vi.mock('../../../services/local-storage.js')

test.each([
  {args: ['--reset', '--json'], result: {status: 'success' as const, changed: false, path: null, clientId: null}},
])('writes exactly one result for $args', async ({args, result}) => {
  const app = testApp()
  vi.mocked(localAppContext).mockResolvedValue({app} as Awaited<ReturnType<typeof localAppContext>>)
  vi.mocked(useAppConfiguration).mockResolvedValue(result)
  const command = new ConfigUse(args, await Config.load())
  vi.spyOn(context, 'isUnitTest').mockReturnValue(false)
  const streams = mockAndCaptureStandardStreams()
  try {
    await expect(command.run()).resolves.toEqual({app})
    expect(streams.stdout()).toBe(`${JSON.stringify(result, null, 2)}\n`)
    expect(streams.stderr()).toBe('')
    expect(checkFolderIsValidApp).toHaveBeenCalled()
    expect(useAppConfiguration).toHaveBeenCalledWith({
      directory: expect.any(String),
      configName: result.path ? 'staging' : undefined,
      reset: result.path === null,
      previousConfigFile: null,
    })
  } finally {
    streams.restore()
  }
})

test('does not reintroduce the config flag', () => {
  expect(ConfigUse.flags).not.toHaveProperty('config')
})

test.each([
  {path: 1, clientId: 'key'},
  {path: '/app/shopify.app.toml', clientId: false},
])('rejects invalid results %j', (result) => {
  expect(() => appConfigUseJsonOutputSchema.validate(result)).toThrow()
})

test.each([{path: 'relative.toml'}, {extra: true}, {clientId: ''}, {status: 'failed'}])(
  'rejects malformed public fields %j',
  (fields) => {
    expect(() =>
      appConfigUseJsonOutputSchema.validate({
        status: 'success',
        changed: true,
        path: '/app/shopify.app.toml',
        clientId: 'key',
        ...fields,
      }),
    ).toThrow()
  },
)

describeJsonCommand({
  command: ConfigUse,
  commandId: 'app:config:use',
  moduleURL: new URL('../../../../../../cli/bin/dev.js', import.meta.url).href,
  args: ['staging'],
  expectedResult: {status: 'success', changed: true, path: '/app/shopify.app.staging.toml', clientId: 'key'},
  expectedSchema: {
    type: 'object',
    required: ['status', 'changed', 'path', 'clientId'],
    additionalProperties: false,
  },
  setup: () => {
    vi.mocked(localAppContext).mockResolvedValue({app: testApp()} as Awaited<ReturnType<typeof localAppContext>>)
    vi.mocked(useAppConfiguration).mockResolvedValue({
      status: 'success',
      changed: true,
      path: '/app/shopify.app.staging.toml',
      clientId: 'key',
    })
  },
  assertExecuted: () => {
    expect(localAppContext).toHaveBeenCalledExactlyOnceWith({
      directory: expect.any(String),
      userProvidedConfigName: 'staging',
    })
    expect(checkFolderIsValidApp).toHaveBeenCalledOnce()
    expect(useAppConfiguration).toHaveBeenCalledExactlyOnceWith({
      directory: expect.any(String),
      configName: 'staging',
      reset: false,
      previousConfigFile: null,
    })
  },
  assertNotExecuted: () => {
    expect(localAppContext).not.toHaveBeenCalled()
    expect(useAppConfiguration).not.toHaveBeenCalled()
  },
  textOutput: ({stdout, stderr}) => {
    expect(stdout).toBe('')
    expect(stderr).toContain('Using configuration file shopify.app.staging.toml')
  },
  failure: {
    setup: () => {
      vi.mocked(useAppConfiguration).mockRejectedValue(
        new AbortError('Could not find configuration file shopify.app.staging.toml'),
      )
    },
    expectedError: {error: {type: 'abort', message: 'Could not find configuration file shopify.app.staging.toml'}},
    exitCode: 1,
  },
})
