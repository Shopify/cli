import ConfigPull from './pull.js'
import pull from '../../../services/app/config/pull.js'
import {appConfigPullJsonOutputSchema} from '../../../services/app/config/pull/types.js'
import {projectAppConfigResult} from '../../../services/app/config/link/types.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {testAppLinked, testOrganizationApp} from '../../../models/app/app.test-data.js'
import {Config} from '@oclif/core'
import {expect, test, vi} from 'vitest'
import * as ui from '@shopify/cli-kit/node/ui'
import {describeJsonCommand} from '@shopify/cli-kit/node/testing/json-command'
import {AbortError} from '@shopify/cli-kit/node/error'

vi.mock('../../../services/app/config/pull.js')
vi.mock('../../../services/app-context.js')

function setup() {
  const app = testAppLinked()
  const remoteApp = testOrganizationApp()
  const result = projectAppConfigResult({
    path: app.configPath,
    appName: app.configuration.name,
    app: remoteApp,
  })
  vi.mocked(linkedAppContext).mockResolvedValue({app, remoteApp} as Awaited<ReturnType<typeof linkedAppContext>>)
  vi.mocked(pull).mockResolvedValue(result)
  return {app, remoteApp, result}
}

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

test('rejects an invalid file path while all other fields are valid', () => {
  expect(() => appConfigPullJsonOutputSchema.validate({...setup().result, path: null})).toThrow()
})

test('returns app identity without duplicated configuration fields', () => {
  const remoteApp = testOrganizationApp({
    redirectUrlWhitelist: [],
    requestedAccessScopes: [],
    webhookApiVersion: '2026-07',
    configuration: testAppLinked().configuration,
  })
  const result = projectAppConfigResult({
    path: setup().result.path,
    appName: 'Configured name',
    app: remoteApp,
  })
  const encoded = JSON.parse(appConfigPullJsonOutputSchema.encode(result))
  expect(Object.keys(encoded)).toEqual(['path', 'app'])
  expect(encoded.app).toEqual({
    id: remoteApp.id,
    gid: null,
    name: 'Configured name',
    clientId: remoteApp.apiKey,
    organizationId: remoteApp.organizationId,
    organizationGid: null,
  })
})

let pullApp: ReturnType<typeof testAppLinked>
let pullRemoteApp: ReturnType<typeof testOrganizationApp>

describeJsonCommand({
  command: ConfigPull,
  commandId: 'app:config:pull',
  moduleURL: new URL('../../../../../../cli/bin/dev.js', import.meta.url).href,
  args: [],
  expectedResult: {
    path: '/tmp/project/shopify.app.toml',
    app: {id: '1', gid: null, name: 'my app', clientId: 'api-key', organizationId: '1', organizationGid: null},
  },
  expectedSchema: {
    type: 'object',
    required: ['path', 'app'],
    additionalProperties: false,
    properties: {app: {$ref: '#/definitions/LinkedApp'}},
  },
  setup: () => {
    pullApp = testAppLinked()
    pullRemoteApp = testOrganizationApp()
    vi.mocked(linkedAppContext).mockResolvedValue({app: pullApp, remoteApp: pullRemoteApp} as Awaited<
      ReturnType<typeof linkedAppContext>
    >)
    vi.mocked(pull).mockResolvedValue({
      path: '/tmp/project/shopify.app.toml',
      app: {id: '1', gid: null, name: 'my app', clientId: 'api-key', organizationId: '1', organizationGid: null},
    })
  },
  assertExecuted: () => {
    expect(linkedAppContext).toHaveBeenCalledExactlyOnceWith({
      directory: expect.any(String),
      clientId: undefined,
      forceRelink: false,
      userProvidedConfigName: undefined,
    })
    expect(pull).toHaveBeenCalledExactlyOnceWith({
      directory: expect.any(String),
      configName: undefined,
      configPath: pullApp.configPath,
      configuration: pullApp.configuration,
      remoteApp: pullRemoteApp,
    })
  },
  assertNotExecuted: () => {
    expect(linkedAppContext).not.toHaveBeenCalled()
    expect(pull).not.toHaveBeenCalled()
  },
  textOutput: ({stdout, stderr}) => {
    expect(stdout).toBe('')
    expect(stderr).toContain(`Pulled latest configuration for "${pullApp.configuration.name}"`)
    expect(stderr).toContain('Updated shopify.app.toml with the remote data.')
  },
  failure: {
    setup: () => {
      vi.mocked(pull).mockRejectedValue(new AbortError('Remote configuration unavailable'))
    },
    expectedError: {error: {type: 'abort', message: 'Remote configuration unavailable'}},
    exitCode: 1,
  },
})
