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

vi.mock('../../../services/app/config/use.js')
vi.mock('../../../services/app-context.js')
vi.mock('../../../models/app/loader.js')

test.each([
  {args: ['staging', '--json'], result: {configFile: '/app/shopify.app.staging.toml', clientId: 'key'}},
  {args: ['--reset', '--json'], result: {configFile: null, clientId: null}},
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
      configName: result.configFile ? 'staging' : undefined,
      reset: result.configFile === null,
    })
  } finally {
    streams.restore()
  }
})

test('exposes the schema without reintroducing the config flag', () => {
  expect(ConfigUse.jsonOutputSchema).toBe(appConfigUseJsonOutputSchema)
  expect(ConfigUse.description).toContain('AppConfigUseResult')
  expect(ConfigUse.flags.json).toBeDefined()
  expect(ConfigUse.flags).not.toHaveProperty('config')
})

test.each([
  {configFile: 1, clientId: 'key'},
  {configFile: '/app/shopify.app.toml', clientId: false},
])('rejects invalid results %j', (result) => {
  expect(() => appConfigUseJsonOutputSchema.validate(result)).toThrow()
})
