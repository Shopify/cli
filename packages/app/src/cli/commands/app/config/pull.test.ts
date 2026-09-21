import ConfigPull from './pull.js'
import pull from '../../../services/app/config/pull.js'
import {appConfigPullJsonOutputSchema} from '../../../services/app/config/pull/types.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {testAppLinked, testOrganizationApp} from '../../../models/app/app.test-data.js'
import {Config} from '@oclif/core'
import {expect, test, vi} from 'vitest'
import * as context from '@shopify/cli-kit/node/context/local'
import * as ui from '@shopify/cli-kit/node/ui'
import {mockAndCaptureStandardStreams} from '@shopify/cli-kit/node/testing/output'

vi.mock('../../../services/app/config/pull.js')
vi.mock('../../../services/app-context.js')

function setup() {
  const app = testAppLinked()
  const remoteApp = testOrganizationApp()
  const result = appConfigPullJsonOutputSchema.validate({
    configFile: app.configPath,
    configuration: app.configuration,
    app: remoteApp,
  })
  vi.mocked(linkedAppContext).mockResolvedValue({app, remoteApp} as Awaited<ReturnType<typeof linkedAppContext>>)
  vi.mocked(pull).mockResolvedValue(result)
  return {app, remoteApp, result}
}

test('exposes the schema in help and retains app flags', () => {
  expect(ConfigPull.jsonOutputSchema).toBe(appConfigPullJsonOutputSchema)
  expect(ConfigPull.description).toContain('AppConfigPullResult')
  expect(ConfigPull.flags.json).toBeDefined()
  expect(ConfigPull.flags.config).toBeDefined()
})

test('writes the real encoded result to stdout', async () => {
  const {app, result} = setup()
  const command = new ConfigPull(['--json'], await Config.load())
  vi.spyOn(context, 'isUnitTest').mockReturnValue(false)
  const streams = mockAndCaptureStandardStreams()
  try {
    await expect(command.run()).resolves.toEqual({app})
    expect(streams.stdout()).toBe(`${appConfigPullJsonOutputSchema.encode(result)}\n`)
    expect(streams.stderr()).toBe('')
  } finally {
    streams.restore()
  }
})

test('preserves text presentation and passes the selected configuration to the service', async () => {
  const {app, remoteApp} = setup()
  const render = vi.spyOn(ui, 'renderSuccess').mockReturnValue(undefined)
  await new ConfigPull(['--config', 'staging'], await Config.load()).run()
  expect(pull).toHaveBeenCalledWith({
    directory: expect.any(String),
    configName: 'staging',
    configPath: app.configPath,
    configuration: app.configuration,
    remoteApp,
  })
  expect(render).toHaveBeenCalledWith({
    headline: `Pulled latest configuration for "${app.configuration.name}"`,
    body: 'Updated shopify.app.toml with the remote data.',
  })
})

test('propagates failures without writing a success document', async () => {
  setup()
  vi.mocked(pull).mockRejectedValue(new Error('Remote configuration unavailable'))
  const command = new ConfigPull(['--json'], await Config.load())
  vi.spyOn(context, 'isUnitTest').mockReturnValue(false)
  const streams = mockAndCaptureStandardStreams()
  try {
    await expect(command.run()).rejects.toThrow('Remote configuration unavailable')
    expect(streams.stdout()).toBe('')
  } finally {
    streams.restore()
  }
})

test('rejects an invalid file path while all other fields are valid', () => {
  expect(() => appConfigPullJsonOutputSchema.validate({...setup().result, configFile: null})).toThrow()
})

test('preserves all available public remote fields without exposing credentials', () => {
  const remoteApp = testOrganizationApp({
    appType: 'custom',
    newApp: false,
    grantedScopes: ['read_products'],
    developmentStorePreviewEnabled: false,
    applicationUrl: 'https://example.com',
    redirectUrlWhitelist: [],
    requestedAccessScopes: [],
    webhookApiVersion: '2026-07',
    embedded: false,
    posEmbedded: false,
    preferencesUrl: '',
    gdprWebhooks: {customerDeletionUrl: '', customerDataRequestUrl: '', shopDeletionUrl: ''},
    appProxy: {subPath: 'example', subPathPrefix: 'apps', url: 'https://example.com/proxy'},
    configuration: testAppLinked().configuration,
  })
  const publicApp = Object.fromEntries(
    Object.entries(remoteApp).filter(
      ([key]) => !['apiSecretKeys', 'flags', 'disabledFlags', 'developerPlatformClient'].includes(key),
    ),
  )
  const result = appConfigPullJsonOutputSchema.validate({...setup().result, app: remoteApp})
  const encoded = JSON.parse(appConfigPullJsonOutputSchema.encode(result))
  expect(encoded.app).toEqual(publicApp)
})
