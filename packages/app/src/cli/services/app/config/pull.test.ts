import pull from './pull.js'
import {loadLocalAppOptions, overwriteLocalConfigFileWithRemoteAppConfiguration} from './link.js'
import {fetchSpecifications} from '../../generate/fetch-extension-specifications.js'
import {testAppLinked, testOrganizationApp} from '../../../models/app/app.test-data.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('./link.js')
vi.mock('../../generate/fetch-extension-specifications.js')

describe('pull', () => {
  beforeEach(() => {
    vi.mocked(loadLocalAppOptions).mockReset()
    vi.mocked(overwriteLocalConfigFileWithRemoteAppConfiguration).mockReset()
    vi.mocked(fetchSpecifications).mockReset()
  })

  test('uses the linked app directory and configuration', async () => {
    const app = testAppLinked({
      directory: '/linked-app',
      configPath: '/linked-app/shopify.app.staging.toml',
    })
    const remoteApp = testOrganizationApp()
    const localAppOptions: Awaited<ReturnType<typeof loadLocalAppOptions>> = {
      state: 'reusable-current-app',
      scopes: 'read_products',
      localAppIdMatchedRemote: true,
      existingBuildOptions: app.configuration.build,
      existingConfig: {...app.configuration},
      appDirectory: app.directory,
      packageManager: 'npm',
    }
    vi.mocked(fetchSpecifications).mockResolvedValue([])
    vi.mocked(loadLocalAppOptions).mockResolvedValue(localAppOptions)
    vi.mocked(overwriteLocalConfigFileWithRemoteAppConfiguration).mockResolvedValue(app.configuration)

    const result = await pull({app, directory: app.directory, configName: 'staging', remoteApp})

    expect(loadLocalAppOptions).toHaveBeenCalledWith(
      {
        directory: app.directory,
        configName: 'staging',
        developerPlatformClient: remoteApp.developerPlatformClient,
        apiKey: app.configuration.client_id,
      },
      [],
      remoteApp.flags,
      remoteApp.apiKey,
    )
    expect(overwriteLocalConfigFileWithRemoteAppConfiguration).toHaveBeenCalledWith({
      remoteApp,
      developerPlatformClient: remoteApp.developerPlatformClient,
      specifications: [],
      flags: remoteApp.flags,
      configFileName: 'shopify.app.staging.toml',
      appDirectory: app.directory,
      localAppOptions,
    })
    expect(result).toEqual({
      configPath: app.configPath,
      configuration: app.configuration,
      remoteApp,
    })
  })

  test('falls back to the invocation subdirectory when a different client ID prevents reusing the local app', async () => {
    const invocationDirectory = '/linked-app/subdirectory'
    const remoteApp = testOrganizationApp({apiKey: 'new-client-id'})
    const app = testAppLinked({
      directory: '/linked-app',
      configPath: '/linked-app/shopify.app.toml',
    })
    // linkedAppContext applies --client-id to the in-memory app, while loadLocalAppOptions sees the different ID on disk.
    app.configuration = {...app.configuration, client_id: remoteApp.apiKey}
    const localAppOptions: Awaited<ReturnType<typeof loadLocalAppOptions>> = {
      state: 'unable-to-reuse-current-config',
      scopes: '',
      localAppIdMatchedRemote: true,
      existingBuildOptions: undefined,
      existingConfig: undefined,
      appDirectory: undefined,
      packageManager: 'npm',
    }
    vi.mocked(fetchSpecifications).mockResolvedValue([])
    vi.mocked(loadLocalAppOptions).mockResolvedValue(localAppOptions)
    vi.mocked(overwriteLocalConfigFileWithRemoteAppConfiguration).mockResolvedValue(app.configuration)

    await pull({app, directory: invocationDirectory, remoteApp})

    expect(loadLocalAppOptions).toHaveBeenCalledWith(
      {
        directory: invocationDirectory,
        configName: undefined,
        developerPlatformClient: remoteApp.developerPlatformClient,
        apiKey: remoteApp.apiKey,
      },
      [],
      remoteApp.flags,
      remoteApp.apiKey,
    )
    expect(overwriteLocalConfigFileWithRemoteAppConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({
        configFileName: 'shopify.app.toml',
        appDirectory: invocationDirectory,
        localAppOptions,
      }),
    )
  })
})
