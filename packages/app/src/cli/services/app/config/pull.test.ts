import pull from './pull.js'
import {loadLocalAppOptions, overwriteLocalConfigFileWithRemoteAppConfiguration} from './link.js'
import {testAppLinked, testOrganizationApp} from '../../../models/app/app.test-data.js'
import {fetchSpecifications} from '../../generate/fetch-extension-specifications.js'
import {expect, test, vi} from 'vitest'

vi.mock('./link.js')
vi.mock('../../generate/fetch-extension-specifications.js')

test('returns the written configuration and public app metadata', async () => {
  const app = testAppLinked()
  const remoteApp = testOrganizationApp()
  vi.mocked(fetchSpecifications).mockResolvedValue([])
  vi.mocked(loadLocalAppOptions).mockResolvedValue({
    state: 'unable-to-load-config',
    localAppIdMatchedRemote: false,
    scopes: '',
    existingBuildOptions: undefined,
    existingConfig: undefined,
    appDirectory: undefined,
    packageManager: 'npm',
  })
  vi.mocked(overwriteLocalConfigFileWithRemoteAppConfiguration).mockResolvedValue(app.configuration)
  const result = await pull({
    directory: app.directory,
    configPath: app.configPath,
    configuration: app.configuration,
    remoteApp,
  })
  expect(result.configFile).toBe(app.configPath)
  expect(result.configuration).toEqual(app.configuration)
  expect(result.app.apiKey).toBe(remoteApp.apiKey)
  expect(result.app).not.toHaveProperty('apiSecretKeys')
  expect(overwriteLocalConfigFileWithRemoteAppConfiguration).toHaveBeenCalledWith(
    expect.objectContaining({configFileName: 'shopify.app.toml', remoteApp, appDirectory: app.directory}),
  )
})

test('rejects an unlinked configuration before fetching remote specifications', async () => {
  const app = testAppLinked()
  await expect(
    pull({
      directory: app.directory,
      configPath: app.configPath,
      configuration: {...app.configuration, client_id: ''},
      remoteApp: testOrganizationApp(),
    }),
  ).rejects.toThrow('The selected configuration is not linked to a remote app.')
  expect(fetchSpecifications).not.toHaveBeenCalled()
})
