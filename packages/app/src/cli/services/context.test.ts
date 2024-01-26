import {
  fetchAppExtensionRegistrations,
  fetchAppDetailsFromApiKey,
  fetchOrgAndApps,
  fetchOrganizations,
  fetchOrgFromId,
  fetchStoreByDomain,
} from './dev/fetch.js'
import {selectOrCreateApp} from './dev/select-app.js'
import {selectStore, convertToTestStoreIfNeeded} from './dev/select-store.js'
import {ensureDeploymentIdsPresence} from './context/identifiers.js'
import {
  DevContextOptions,
  ensureDevContext,
  ensureDeployContext,
  ensureThemeExtensionDevContext,
  ensureGenerateContext,
  DeployContextOptions,
  ensureReleaseContext,
  ensureVersionsListContext,
  ensureDraftExtensionsPushContext,
  DraftExtensionsPushOptions,
} from './context.js'
import {createExtension} from './dev/create-extension.js'
import {CachedAppInfo, clearCachedAppInfo, getCachedAppInfo, setCachedAppInfo} from './local-storage.js'
import link from './app/config/link.js'
import {fetchPartnersSession} from './context/partner-account-info.js'
import {fetchSpecifications} from './generate/fetch-extension-specifications.js'
import * as writeAppConfigurationFile from './app/write-app-configuration-file.js'
import {BetaFlag} from './app/select-app.js'
import {loadFSExtensionsSpecifications} from '../models/extensions/load-specifications.js'
import {Organization, OrganizationApp, OrganizationStore} from '../models/organization.js'
import {updateAppIdentifiers, getAppIdentifiers} from '../models/app/identifiers.js'
import {reuseDevConfigPrompt, selectOrganizationPrompt} from '../prompts/dev.js'
import {
  DEFAULT_CONFIG,
  testPartnersUserSession,
  testApp,
  testAppWithConfig,
  testOrganizationApp,
  testThemeExtensions,
  testAppConfigExtensions,
  buildVersionedAppSchema,
} from '../models/app/app.test-data.js'
import metadata from '../metadata.js'
import {
  getAppConfigurationFileName,
  isWebType,
  loadApp,
  loadAppConfiguration,
  loadAppName,
} from '../models/app/loader.js'
import {AppInterface, CurrentAppConfiguration} from '../models/app/app.js'
import * as loadSpecifications from '../models/extensions/load-specifications.js'
import {afterEach, beforeAll, beforeEach, describe, expect, test, vi} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {getPackageManager} from '@shopify/cli-kit/node/node-package-manager'
import {inTemporaryDirectory, readFile, writeFileSync} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {renderConfirmationPrompt, renderInfo, renderTasks, Task} from '@shopify/cli-kit/node/ui'
import {Config} from '@oclif/core'
import {setPathValue} from '@shopify/cli-kit/common/object'

const COMMAND_CONFIG = {runHook: vi.fn(() => Promise.resolve({successes: []}))} as unknown as Config

const APP1: OrganizationApp = testOrganizationApp({
  id: '1',
  title: 'app1',
  apiKey: 'key1',
  apiSecretKeys: [{secret: 'secret1'}],
})
const APP2 = testOrganizationApp({
  id: '2',
  title: 'app2',
  apiKey: 'key2',
  apiSecretKeys: [{secret: 'secret2'}],
})

const ORG1: Organization = {
  id: '1',
  businessName: 'org1',
  website: '',
}
const ORG2: Organization = {
  id: '2',
  businessName: 'org2',
  website: '',
}

const CACHED1: CachedAppInfo = {appId: 'key1', orgId: '1', storeFqdn: 'domain1', directory: '/cached'}
const CACHED1_WITH_CONFIG: CachedAppInfo = {...CACHED1, configFile: 'shopify.app.toml'}
const STORE1: OrganizationStore = {
  shopId: '1',
  link: 'link1',
  shopDomain: 'domain1',
  shopName: 'store1',
  transferDisabled: true,
  convertableToPartnerTest: true,
}
const STORE2: OrganizationStore = {
  shopId: '2',
  link: 'link2',
  shopDomain: 'domain2',
  shopName: 'store2',
  transferDisabled: false,
  convertableToPartnerTest: false,
}

const INPUT: DevContextOptions = {
  directory: 'app_directory',
  reset: false,
  commandConfig: COMMAND_CONFIG,
}

const INPUT_WITH_DATA: DevContextOptions = {
  directory: 'app_directory',
  reset: false,
  apiKey: 'key1',
  storeFqdn: 'domain1',
  commandConfig: COMMAND_CONFIG,
}

const BAD_INPUT_WITH_DATA: DevContextOptions = {
  directory: 'app_directory',
  reset: false,
  apiKey: 'key1',
  storeFqdn: 'invalid_store_domain',
  commandConfig: COMMAND_CONFIG,
}

const FETCH_RESPONSE = {
  organization: ORG1,
  apps: {nodes: [APP1, APP2], pageInfo: {hasNextPage: false}},
  stores: [STORE1, STORE2],
}

const DEFAULT_SELECT_APP_OPTIONS = {
  directory: undefined,
  isLaunchable: true,
  scopesArray: [],
}

const options = (app: AppInterface, reset = false, force = false): DeployContextOptions => {
  return {
    app,
    reset,
    force,
    noRelease: false,
    commandConfig: COMMAND_CONFIG,
  }
}

const draftExtensionsPushOptions = (app: AppInterface): DraftExtensionsPushOptions => {
  return {
    directory: app.directory,
    reset: false,
    commandConfig: COMMAND_CONFIG,
    enableDeveloperPreview: false,
  }
}

vi.mock('./local-storage.js')
vi.mock('./dev/fetch')
vi.mock('./dev/create-extension')
vi.mock('./dev/select-app')
vi.mock('./dev/select-store')
vi.mock('../prompts/dev')
vi.mock('../models/app/identifiers')
vi.mock('./context/identifiers')
vi.mock('../models/app/loader.js')
vi.mock('@shopify/cli-kit/node/node-package-manager.js')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('./deploy/mode.js')
vi.mock('./app/config/link.js')
vi.mock('./context/partner-account-info.js')
vi.mock('./generate/fetch-extension-specifications.js')
vi.mock('./app/select-app.js')

beforeAll(async () => {
  vi.mocked(fetchSpecifications).mockResolvedValue(await loadFSExtensionsSpecifications())
})

beforeEach(async () => {
  vi.mocked(getAppIdentifiers).mockReturnValue({app: undefined})
  vi.mocked(selectOrganizationPrompt).mockResolvedValue(ORG1)
  vi.mocked(selectOrCreateApp).mockResolvedValue(APP1)
  vi.mocked(selectStore).mockResolvedValue(STORE1)
  vi.mocked(fetchOrganizations).mockResolvedValue([ORG1, ORG2])
  vi.mocked(fetchOrgFromId).mockResolvedValue(ORG1)
  vi.mocked(fetchOrgAndApps).mockResolvedValue(FETCH_RESPONSE)
  vi.mocked(getPackageManager).mockResolvedValue('npm')
  vi.mocked(fetchPartnersSession).mockResolvedValue(testPartnersUserSession)
  vi.mocked(isWebType).mockReturnValue(true)

  // this is needed because using importActual to mock the ui module
  // creates a circular dependency between ui and context/local
  // so we need to mock the whole module and just replace the functions we use
  vi.mocked(renderTasks).mockImplementation(async (tasks: Task[]) => {
    for (const task of tasks) {
      // eslint-disable-next-line no-await-in-loop
      await task.task({}, task)
    }
  })
})

afterEach(() => {
  mockAndCaptureOutput().clear()
})

describe('ensureGenerateContext', () => {
  beforeEach(async () => {
    const {schema: configSchema} = await buildVersionedAppSchema()
    vi.mocked(loadAppConfiguration).mockResolvedValue({
      directory: '/app',
      configuration: {
        path: '/app/shopify.app.toml',
        scopes: 'read_products',
      },
      configSchema,
    })
  })

  test('returns the provided app apiKey if valid, without cached state', async () => {
    // Given
    const input = {
      apiKey: 'key2',
      directory: '/app',
      reset: false,
      partnersSession: testPartnersUserSession,
      commandConfig: COMMAND_CONFIG,
    }
    vi.mocked(fetchAppDetailsFromApiKey).mockResolvedValueOnce(APP2)

    // When
    const got = await ensureGenerateContext(input)

    // Then
    expect(got).toEqual(APP2.apiKey)
  })

  test('returns the cached api key', async () => {
    // Given
    const input = {
      directory: '/app',
      reset: false,
      partnersSession: testPartnersUserSession,
      commandConfig: COMMAND_CONFIG,
    }
    vi.mocked(fetchAppDetailsFromApiKey).mockResolvedValueOnce(APP2)
    vi.mocked(getCachedAppInfo).mockReturnValue(CACHED1)

    // When
    const got = await ensureGenerateContext(input)

    // Then
    expect(got).toEqual(APP2.apiKey)
  })

  test('returns the api key from the current config', async () => {
    // Given
    const input = {
      directory: '/app',
      reset: false,
      partnersSession: testPartnersUserSession,
      commandConfig: COMMAND_CONFIG,
    }
    vi.mocked(getCachedAppInfo).mockReturnValue(CACHED1_WITH_CONFIG)
    vi.mocked(loadAppConfiguration).mockReset()
    const {schema: configSchema} = await buildVersionedAppSchema()
    vi.mocked(loadAppConfiguration).mockResolvedValueOnce({
      directory: '/app',
      configuration: testAppWithConfig({config: {path: CACHED1_WITH_CONFIG.configFile, client_id: APP2.apiKey}})
        .configuration,
      configSchema,
    })
    vi.mocked(fetchAppDetailsFromApiKey).mockResolvedValue(APP2)

    // When
    const got = await ensureGenerateContext(input)

    // Then
    expect(fetchAppDetailsFromApiKey).toHaveBeenCalledWith(APP2.apiKey, 'token')
    expect(got).toEqual(APP2.apiKey)
  })

  test('links an app on first command run', async () => {
    // Given
    const input = {
      directory: '/app',
      reset: false,
      partnersSession: testPartnersUserSession,
      commandConfig: COMMAND_CONFIG,
    }
    vi.mocked(getCachedAppInfo).mockReturnValueOnce(undefined).mockReturnValue(CACHED1_WITH_CONFIG)
    vi.mocked(loadAppConfiguration).mockReset()
    const {schema: configSchema} = await buildVersionedAppSchema()
    vi.mocked(loadAppConfiguration).mockResolvedValueOnce({
      directory: '/app',
      configuration: testAppWithConfig({config: {path: CACHED1_WITH_CONFIG.configFile, client_id: APP2.apiKey}})
        .configuration,
      configSchema,
    })
    vi.mocked(fetchAppDetailsFromApiKey).mockResolvedValue(APP2)

    // When
    const got = await ensureGenerateContext(input)

    // Then
    expect(link).toBeCalled()
    expect(fetchAppDetailsFromApiKey).toHaveBeenCalledWith(APP2.apiKey, 'token')
    expect(got).toEqual(APP2.apiKey)
  })

  test('links an app on reset if already opted into config in code', async () => {
    // Given
    const input = {
      directory: '/app',
      reset: true,
      partnersSession: testPartnersUserSession,
      commandConfig: COMMAND_CONFIG,
    }
    vi.mocked(getCachedAppInfo).mockReturnValue(CACHED1_WITH_CONFIG)
    vi.mocked(loadAppConfiguration).mockReset()
    const {schema: configSchema} = await buildVersionedAppSchema()
    vi.mocked(loadAppConfiguration).mockResolvedValueOnce({
      directory: '/app',
      configuration: testAppWithConfig({config: {path: CACHED1_WITH_CONFIG.configFile, client_id: APP2.apiKey}})
        .configuration,
      configSchema,
    })
    vi.mocked(fetchAppDetailsFromApiKey).mockResolvedValue(APP2)

    // When
    const got = await ensureGenerateContext(input)

    // Then
    expect(link).toBeCalled()
    expect(fetchAppDetailsFromApiKey).toHaveBeenCalledWith(APP2.apiKey, 'token')
    expect(got).toEqual(APP2.apiKey)
  })

  test('selects a new app and returns the api key', async () => {
    // Given
    const input = {
      directory: '/app',
      reset: true,
      partnersSession: testPartnersUserSession,
      commandConfig: COMMAND_CONFIG,
    }
    vi.mocked(fetchAppDetailsFromApiKey).mockResolvedValueOnce(APP2)
    vi.mocked(loadAppName).mockResolvedValueOnce('my-app')
    vi.mocked(getCachedAppInfo).mockReturnValue(undefined)

    // When
    const got = await ensureGenerateContext(input)

    // Then
    expect(got).toEqual(APP1.apiKey)
    expect(selectOrCreateApp).toHaveBeenCalledWith(
      'my-app',
      {nodes: [APP1, APP2], pageInfo: {hasNextPage: false}},
      ORG1,
      testPartnersUserSession,
    )
    expect(setCachedAppInfo).toHaveBeenCalledWith({
      appId: APP1.apiKey,
      title: APP1.title,
      directory: '/app',
      orgId: ORG1.id,
    })
  })
})

describe('ensureDevContext', async () => {
  beforeEach(async () => {
    const {schema: configSchema} = await buildVersionedAppSchema()
    vi.mocked(loadAppConfiguration).mockResolvedValue({
      directory: '/app',
      configuration: {
        path: '/app/shopify.app.toml',
        scopes: 'read_products',
      },
      configSchema,
    })
  })

  test('returns selected data using config file set in cache', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      vi.mocked(getCachedAppInfo).mockReturnValue(CACHED1_WITH_CONFIG)
      vi.mocked(loadAppConfiguration).mockReset()
      const {schema: configSchema} = await buildVersionedAppSchema()
      const localApp = {
        configuration: {
          ...DEFAULT_CONFIG,
          path: joinPath(tmp, CACHED1_WITH_CONFIG.configFile!),
          name: APP2.apiKey,
          client_id: APP2.apiKey,
          build: {
            automatically_update_urls_on_dev: true,
            dev_store_url: STORE1.shopDomain,
          },
        } as CurrentAppConfiguration,
      }
      vi.mocked(loadAppConfiguration).mockResolvedValue({
        directory: tmp,
        configuration: localApp.configuration,
        configSchema,
      })
      vi.mocked(fetchAppDetailsFromApiKey).mockResolvedValueOnce(APP2)
      vi.mocked(fetchStoreByDomain).mockResolvedValue({organization: ORG1, store: STORE1})
      const app = await mockApp(tmp, localApp)
      vi.mocked(loadApp).mockResolvedValue(app)

      // When
      const got = await ensureDevContext(
        {
          directory: 'app_directory',
          reset: false,
          commandConfig: COMMAND_CONFIG,
        },
        testPartnersUserSession,
      )

      // Then
      expect(got).toEqual({
        remoteApp: {...APP2, apiSecret: 'secret2'},
        storeFqdn: STORE1.shopDomain,
        storeId: STORE1.shopId,
        remoteAppUpdated: true,
        updateURLs: true,
        localApp: app,
      })
      expect(setCachedAppInfo).not.toHaveBeenCalled()

      expect(metadata.getAllPublicMetadata()).toMatchObject({
        api_key: APP2.apiKey,
        partner_id: 1,
      })
    })
  })

  test('returns context from client-id flag rather than config in cache', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const expectedContent = `# Learn more about configuring your app at https://shopify.dev/docs/apps/tools/cli/configuration
name = "my app"
client_id = "12345"
application_url = "https://myapp.com"
embedded = true

[access_scopes]
# Learn more at https://shopify.dev/docs/apps/tools/cli/configuration#access_scopes
scopes = "read_products"

[webhooks]
api_version = "2023-04"

[build]
dev_store_url = "domain1"
`
      const filePath = joinPath(tmp, 'shopify.app.toml')
      writeFileSync(filePath, expectedContent)
      vi.mocked(getCachedAppInfo).mockReturnValue(CACHED1_WITH_CONFIG)
      vi.mocked(loadAppConfiguration).mockReset()
      const {schema: configSchema} = await buildVersionedAppSchema()
      vi.mocked(loadAppConfiguration).mockResolvedValue({
        directory: tmp,
        configuration: testAppWithConfig({
          config: {
            path: joinPath(tmp, CACHED1_WITH_CONFIG.configFile!),
            name: APP1.apiKey,
            client_id: APP1.apiKey,
            build: {
              automatically_update_urls_on_dev: true,
              dev_store_url: STORE1.shopDomain,
            },
          },
        }).configuration,
        configSchema,
      })
      vi.mocked(fetchAppDetailsFromApiKey).mockResolvedValueOnce(APP1).mockResolvedValue(APP2)
      vi.mocked(fetchStoreByDomain).mockResolvedValue({organization: ORG1, store: STORE1})

      // When
      const got = await ensureDevContext(
        {
          directory: 'app_directory',
          reset: false,
          commandConfig: COMMAND_CONFIG,
          apiKey: APP2.apiKey,
        },
        testPartnersUserSession,
      )

      // Then
      expect(got).toEqual({
        remoteApp: {...APP2, apiSecret: 'secret2'},
        storeFqdn: STORE1.shopDomain,
        storeId: STORE1.shopId,
        remoteAppUpdated: true,
        updateURLs: true,
      })
      expect(setCachedAppInfo).not.toHaveBeenCalled()

      expect(metadata.getAllPublicMetadata()).toMatchObject({
        api_key: APP2.apiKey,
        partner_id: 1,
      })

      const content = await readFile(joinPath(tmp, 'shopify.app.toml'))
      expect(content).toEqual(expectedContent)
    })
  })

  test('loads the correct file when config flag is passed in', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      vi.mocked(getCachedAppInfo).mockReturnValue(undefined)
      vi.mocked(loadAppConfiguration).mockReset()
      const localApp = {
        configuration: {
          path: joinPath(tmp, 'shopify.app.dev.toml'),
          name: 'my app',
          client_id: '12345',
          scopes: 'write_products',
          webhooks: {api_version: '2023-04'},
          application_url: 'https://myapp.com',
          embedded: true,
        } as CurrentAppConfiguration,
      }
      const {schema: configSchema} = await buildVersionedAppSchema()
      vi.mocked(loadAppConfiguration).mockResolvedValue({
        directory: tmp,
        configuration: localApp.configuration,
        configSchema,
      })
      vi.mocked(fetchAppDetailsFromApiKey).mockResolvedValueOnce(APP2)
      vi.mocked(fetchStoreByDomain).mockResolvedValue({organization: ORG1, store: STORE1})
      const app = await mockApp(tmp, localApp)
      vi.mocked(loadApp).mockResolvedValue(app)

      // When
      await ensureDevContext(
        {
          directory: 'app_directory',
          reset: false,
          commandConfig: COMMAND_CONFIG,
        },
        testPartnersUserSession,
      )

      // Then
      expect(loadAppConfiguration).toHaveBeenCalledWith({
        directory: 'app_directory',
      })
    })
  })

  test('prompts to select store when not set in config file', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const filePath = joinPath(tmp, 'shopify.app.dev.toml')
      writeFileSync(filePath, '')
      vi.mocked(loadAppConfiguration).mockReset()
      const {schema: configSchema} = await buildVersionedAppSchema()
      const localApp = {
        configuration: {
          ...DEFAULT_CONFIG,
          path: joinPath(tmp, 'shopify.app.dev.toml'),
        } as CurrentAppConfiguration,
      }

      vi.mocked(loadAppConfiguration).mockResolvedValue({
        directory: tmp,
        configuration: localApp.configuration,
        configSchema,
      })
      vi.mocked(fetchAppDetailsFromApiKey).mockResolvedValueOnce(APP2)
      const app = await mockApp(tmp, localApp)
      vi.mocked(loadApp).mockResolvedValue(app)

      // When
      await ensureDevContext(
        {
          directory: 'app_directory',
          reset: false,
          commandConfig: COMMAND_CONFIG,
        },
        testPartnersUserSession,
      )

      // Then
      expect(selectStore).toHaveBeenCalled()
      const content = await readFile(joinPath(tmp, 'shopify.app.dev.toml'))
      const expectedContent = `# Learn more about configuring your app at https://shopify.dev/docs/apps/tools/cli/configuration

client_id = "12345"
name = "my app"
application_url = "https://myapp.com"
embedded = true

[build]
dev_store_url = "domain1"

[access_scopes]
# Learn more at https://shopify.dev/docs/apps/tools/cli/configuration#access_scopes
scopes = "read_products"

[webhooks]
api_version = "2023-04"
`
      expect(content).toEqual(expectedContent)
    })
  })

  test('shows the correct banner content when running for the first time with linked config file', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      vi.mocked(getCachedAppInfo).mockReturnValue(undefined)
      vi.mocked(loadAppConfiguration).mockReset()
      const {schema: configSchema} = await buildVersionedAppSchema()
      const localApp = {
        configuration: {
          ...DEFAULT_CONFIG,
          path: joinPath(tmp, 'shopify.app.toml'),
        } as CurrentAppConfiguration,
      }
      vi.mocked(loadAppConfiguration).mockResolvedValue({
        directory: tmp,
        configuration: localApp.configuration,
        configSchema,
      })

      vi.mocked(getAppConfigurationFileName).mockReturnValue('shopify.app.toml')
      vi.mocked(fetchAppDetailsFromApiKey).mockResolvedValueOnce(APP2)
      vi.mocked(fetchStoreByDomain).mockResolvedValue({organization: ORG1, store: STORE1})
      const app = await mockApp(tmp, localApp)
      vi.mocked(loadApp).mockResolvedValue(app)

      // When
      const val = await ensureDevContext(
        {
          directory: 'app_directory',
          reset: false,
          commandConfig: COMMAND_CONFIG,
        },
        testPartnersUserSession,
      )

      // Then
      expect(renderInfo).toHaveBeenCalledWith({
        body: [
          {
            list: {
              items: [
                `Org:             ${ORG1.businessName}`,
                `App:             ${APP2.title}`,
                `Dev store:       ${STORE1.shopDomain}`,
                'Update URLs:     Not yet configured',
              ],
            },
          },
          '\n',
          'You can pass',
          {
            command: '--reset',
          },
          'to your command to reset your app configuration.',
        ],
        headline: 'Using shopify.app.toml:',
      })
    })
  })

  test('returns selected data and updates internal state, without cached state', async () => {
    // Given
    vi.mocked(getCachedAppInfo).mockReturnValue(undefined)

    // When
    const got = await ensureDevContext(INPUT, testPartnersUserSession)

    // Then
    expect(got).toEqual({
      remoteApp: {...APP1, apiSecret: 'secret1'},
      storeFqdn: STORE1.shopDomain,
      storeId: STORE1.shopId,
      remoteAppUpdated: true,
      updateURLs: undefined,
    })
    expect(setCachedAppInfo).toHaveBeenNthCalledWith(1, {
      appId: APP1.apiKey,
      title: APP1.title,
      storeFqdn: STORE1.shopDomain,
      directory: INPUT.directory,
      orgId: ORG1.id,
    })

    expect(metadata.getAllPublicMetadata()).toMatchObject({
      api_key: APP1.apiKey,
      partner_id: 1,
    })
  })

  test('returns remoteAppUpdated true when previous app id is different', async () => {
    // Given
    vi.mocked(getCachedAppInfo).mockReturnValue({...CACHED1_WITH_CONFIG, previousAppId: APP2.apiKey})
    // vi.mocked(fetchOrgFromId).mockResolvedValueOnce(ORG2)
    vi.mocked(fetchAppDetailsFromApiKey).mockResolvedValueOnce(APP1)
    vi.mocked(fetchStoreByDomain).mockResolvedValue({organization: ORG1, store: STORE1})

    // When
    const got = await ensureDevContext(INPUT, testPartnersUserSession)

    // Then
    expect(got).toEqual({
      remoteApp: {...APP1, apiSecret: 'secret1'},
      storeFqdn: STORE1.shopDomain,
      storeId: STORE1.shopId,
      remoteAppUpdated: true,
      updateURLs: undefined,
    })
  })

  test('returns selected data and updates internal state, with cached state', async () => {
    // Given
    vi.mocked(getCachedAppInfo).mockReturnValue({...CACHED1, previousAppId: APP1.apiKey})
    vi.mocked(fetchAppDetailsFromApiKey).mockResolvedValueOnce(APP1)
    vi.mocked(fetchStoreByDomain).mockResolvedValue({organization: ORG1, store: STORE1})

    // When
    const got = await ensureDevContext(INPUT, testPartnersUserSession)

    // Then
    expect(got).toEqual({
      remoteApp: {...APP1, apiSecret: 'secret1'},
      storeFqdn: STORE1.shopDomain,
      storeId: STORE1.shopId,
      remoteAppUpdated: false,
      updateURLs: undefined,
    })
    expect(fetchOrganizations).not.toBeCalled()
    expect(selectOrganizationPrompt).not.toBeCalled()
    expect(setCachedAppInfo).toHaveBeenNthCalledWith(1, {
      appId: APP1.apiKey,
      title: APP1.title,
      storeFqdn: STORE1.shopDomain,
      directory: INPUT.directory,
      orgId: ORG1.id,
    })
    expect(renderInfo).toHaveBeenCalledWith({
      body: [
        {
          list: {
            items: [
              'Org:             org1',
              'App:             app1',
              'Dev store:       domain1',
              'Update URLs:     Not yet configured',
            ],
          },
        },
        '\n',
        'You can pass',
        {
          command: '--reset',
        },
        'to your command to reset your app configuration.',
      ],
      headline: 'Using these settings:',
    })
    expect(fetchOrgAndApps).not.toBeCalled()
  })

  test('returns selected data and updates internal state, with inputs from flags', async () => {
    // Given
    vi.mocked(getCachedAppInfo).mockReturnValue(undefined)
    vi.mocked(convertToTestStoreIfNeeded).mockResolvedValueOnce()
    vi.mocked(fetchAppDetailsFromApiKey).mockResolvedValueOnce(APP2)
    vi.mocked(fetchStoreByDomain).mockResolvedValue({organization: ORG1, store: STORE1})

    // When
    const got = await ensureDevContext(INPUT_WITH_DATA, testPartnersUserSession)

    // Then
    expect(got).toEqual({
      remoteApp: {...APP2, apiSecret: 'secret2'},
      storeFqdn: STORE1.shopDomain,
      storeId: STORE1.shopId,
      remoteAppUpdated: true,
      updateURLs: undefined,
    })
    expect(setCachedAppInfo).toHaveBeenNthCalledWith(1, {
      appId: APP2.apiKey,
      directory: INPUT_WITH_DATA.directory,
      storeFqdn: STORE1.shopDomain,
      orgId: ORG1.id,
      title: APP2.title,
    })
    expect(fetchOrganizations).toBeCalled()
    expect(selectOrganizationPrompt).toBeCalled()
    expect(selectOrCreateApp).not.toBeCalled()
    expect(selectStore).not.toBeCalled()
    expect(fetchOrgAndApps).not.toBeCalled()
  })

  test('throws if the store input is not valid', async () => {
    // Given
    vi.mocked(getCachedAppInfo).mockReturnValue(undefined)
    vi.mocked(fetchAppDetailsFromApiKey).mockResolvedValueOnce(APP2)
    vi.mocked(fetchStoreByDomain).mockResolvedValue({organization: ORG1, store: undefined})

    // When
    const got = ensureDevContext(BAD_INPUT_WITH_DATA, testPartnersUserSession)

    await expect(got).rejects.toThrow(/Could not find invalid_store_domain/)
  })

  test('resets cached state if reset is true', async () => {
    // When
    vi.mocked(getCachedAppInfo).mockReturnValueOnce(CACHED1)
    vi.mocked(fetchAppDetailsFromApiKey).mockResolvedValueOnce(APP2)

    await ensureDevContext({...INPUT, reset: true}, testPartnersUserSession)

    // Then
    expect(clearCachedAppInfo).toHaveBeenCalledWith(BAD_INPUT_WITH_DATA.directory)
    expect(fetchOrgAndApps).toBeCalled()
    expect(link).not.toBeCalled()
  })

  test('reset triggers link if opted into config in code', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      vi.mocked(getCachedAppInfo).mockReturnValueOnce(CACHED1_WITH_CONFIG)
      const filePath = joinPath(tmp, 'shopify.app.dev.toml')
      const localApp = {
        configuration: {
          ...DEFAULT_CONFIG,
          path: filePath,
          client_id: APP2.apiKey,
          name: APP2.apiKey,
          application_url: APP2.applicationUrl,
          webhooks: {api_version: '2023-04'},
          embedded: true,
        } as CurrentAppConfiguration,
      }
      const {schema: configSchema} = await buildVersionedAppSchema()
      vi.mocked(loadAppConfiguration).mockResolvedValue({
        directory: tmp,
        configuration: localApp.configuration,
        configSchema,
      })
      vi.mocked(fetchAppDetailsFromApiKey).mockResolvedValue(APP2)
      const app = await mockApp(tmp, localApp)
      vi.mocked(loadApp).mockResolvedValue(app)

      // When
      const got = await ensureDevContext({...INPUT, reset: true}, testPartnersUserSession)

      // Then
      expect(link).toBeCalled()
      expect(got.remoteApp).toEqual({...APP2, apiSecret: 'secret2'})
    })
  })

  test('links an app when running dev for the first time', async () => {
    // Given
    const mockOutput = mockAndCaptureOutput()

    // When
    await ensureDevContext(INPUT, testPartnersUserSession)

    // Then
    expect(link).toBeCalled()
  })

  test('links app if no app configs exist & cache has a current config file defined', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      vi.mocked(getCachedAppInfo).mockReturnValueOnce(CACHED1_WITH_CONFIG)
      const filePath = joinPath(tmp, 'shopify.app.toml')
      const {schema: configSchema} = await buildVersionedAppSchema()
      const localApp = {
        configuration: {
          ...DEFAULT_CONFIG,
          path: filePath,
          client_id: APP2.apiKey,
          name: APP2.apiKey,
          application_url: APP2.applicationUrl,
          webhooks: {api_version: '2023-04'},
          embedded: true,
        } as CurrentAppConfiguration,
      }
      vi.mocked(loadAppConfiguration).mockResolvedValue({
        directory: tmp,
        configuration: localApp.configuration,
        configSchema,
      })
      vi.mocked(fetchAppDetailsFromApiKey).mockResolvedValue(APP2)
      const app = await mockApp(tmp, localApp)
      vi.mocked(loadApp).mockResolvedValue(app)

      // When
      const got = await ensureDevContext({...INPUT}, testPartnersUserSession)

      // Then
      expect(link).toBeCalled()
      expect(got.remoteApp).toEqual({...APP2, apiSecret: 'secret2'})
    })
  })
})

describe('ensureDeployContext', () => {
  test("fetches the app from the partners' API and returns it alongside the id when identifiers are available locally and the app has no extensions", async () => {
    // Given
    const app = testApp()
    const identifiers = {
      app: APP2.apiKey,
      extensions: {},
      extensionIds: {},
      extensionsNonUuidManaged: {},
    }
    vi.mocked(getAppIdentifiers).mockReturnValue({app: APP2.apiKey})
    vi.mocked(fetchAppDetailsFromApiKey).mockResolvedValueOnce(APP2)
    vi.mocked(ensureDeploymentIdsPresence).mockResolvedValue(identifiers)
    vi.mocked(loadApp).mockResolvedValue(app)

    // When
    const got = await ensureDeployContext(options(app))

    // Then
    expect(selectOrCreateApp).not.toHaveBeenCalled()
    expect(got.partnersApp.id).toEqual(APP2.id)
    expect(got.partnersApp.title).toEqual(APP2.title)
    expect(got.partnersApp.appType).toEqual(APP2.appType)
    expect(got.identifiers).toEqual(identifiers)
    expect(got.release).toEqual(true)

    expect(metadata.getAllPublicMetadata()).toMatchObject({api_key: APP2.apiKey, partner_id: 1})
  })

  test("fetches the app from the partners' API and returns it alongside the id when there are no identifiers but user chooses to reuse dev store.cliKitStore()", async () => {
    // Given
    const app = testApp()
    const identifiers = {
      app: APP2.apiKey,
      extensions: {},
      extensionIds: {},
      extensionsNonUuidManaged: {},
    }
    vi.mocked(getAppIdentifiers).mockReturnValue({app: undefined})
    vi.mocked(getCachedAppInfo).mockReturnValue(CACHED1)
    vi.mocked(fetchAppDetailsFromApiKey).mockResolvedValueOnce(APP2)
    vi.mocked(ensureDeploymentIdsPresence).mockResolvedValue(identifiers)
    vi.mocked(reuseDevConfigPrompt).mockResolvedValueOnce(true)
    vi.mocked(loadApp).mockResolvedValue(app)

    // When
    const got = await ensureDeployContext(options(app))

    // Then
    expect(selectOrCreateApp).not.toHaveBeenCalled()
    expect(reuseDevConfigPrompt).toHaveBeenCalled()
    expect(got.partnersApp.id).toEqual(APP2.id)
    expect(got.partnersApp.title).toEqual(APP2.title)
    expect(got.partnersApp.appType).toEqual(APP2.appType)
    expect(got.identifiers).toEqual(identifiers)
    expect(got.release).toEqual(true)
  })

  test("fetches the app from the partners' API and returns it alongside the id when config as code is enabled", async () => {
    // Given
    const app = testAppWithConfig({config: {client_id: APP2.apiKey}})
    const identifiers = {
      app: APP2.apiKey,
      extensions: {},
      extensionIds: {},
      extensionsNonUuidManaged: {},
    }
    vi.mocked(getAppIdentifiers).mockReturnValue({app: undefined})
    vi.mocked(fetchAppDetailsFromApiKey).mockResolvedValueOnce(APP2)
    vi.mocked(ensureDeploymentIdsPresence).mockResolvedValue(identifiers)
    vi.mocked(loadApp).mockResolvedValue(app)
    const writeAppConfigurationFileSpy = vi
      .spyOn(writeAppConfigurationFile, 'writeAppConfigurationFile')
      .mockResolvedValue()

    // When
    const got = await ensureDeployContext(options(app))

    // Then
    expect(selectOrCreateApp).not.toHaveBeenCalled()
    expect(reuseDevConfigPrompt).not.toHaveBeenCalled()
    expect(fetchAppDetailsFromApiKey).toHaveBeenCalledWith(APP2.apiKey, 'token')
    expect(got.partnersApp.id).toEqual(APP2.id)
    expect(got.partnersApp.title).toEqual(APP2.title)
    expect(got.partnersApp.appType).toEqual(APP2.appType)
    expect(got.identifiers).toEqual(identifiers)
    expect(got.release).toEqual(true)
    writeAppConfigurationFileSpy.mockRestore()
  })

  test('prompts the user to create or select an app and returns it with its id when the app has no extensions', async () => {
    // Given
    const app = testApp()
    const identifiers = {
      app: APP1.apiKey,
      extensions: {},
      extensionIds: {},
      extensionsNonUuidManaged: {},
    }
    vi.mocked(getAppIdentifiers).mockReturnValue({app: undefined})
    vi.mocked(fetchAppDetailsFromApiKey).mockResolvedValueOnce(APP2)
    vi.mocked(ensureDeploymentIdsPresence).mockResolvedValue(identifiers)
    vi.mocked(loadApp).mockResolvedValue(app)

    // When
    const got = await ensureDeployContext(options(app))

    // Then
    expect(fetchOrganizations).toHaveBeenCalledWith(testPartnersUserSession)
    expect(selectOrCreateApp).toHaveBeenCalledWith(
      app.name,
      {nodes: [APP1, APP2], pageInfo: {hasNextPage: false}},
      ORG1,
      testPartnersUserSession,
      DEFAULT_SELECT_APP_OPTIONS,
    )
    expect(updateAppIdentifiers).toBeCalledWith({
      app,
      identifiers,
      command: 'deploy',
    })
    expect(got.partnersApp.id).toEqual(APP1.id)
    expect(got.partnersApp.title).toEqual(APP1.title)
    expect(got.partnersApp.appType).toEqual(APP1.appType)
    expect(got.identifiers).toEqual({app: APP1.apiKey, extensions: {}, extensionIds: {}, extensionsNonUuidManaged: {}})
    expect(got.release).toEqual(true)
  })

  test("throws an app not found error if the app with the Client ID doesn't exist", async () => {
    // Given
    const app = testApp()
    vi.mocked(getAppIdentifiers).mockReturnValue({app: APP1.apiKey})
    vi.mocked(fetchAppDetailsFromApiKey).mockResolvedValueOnce(undefined)
    vi.mocked(loadApp).mockResolvedValue(app)

    // When
    await expect(ensureDeployContext(options(app))).rejects.toThrow(/Couldn't find the app with Client ID key1/)
  })

  test('prompts the user to create or select an app if reset is true', async () => {
    // Given
    const app = testApp()
    const identifiers = {
      app: APP1.apiKey,
      extensions: {},
      extensionIds: {},
      extensionsNonUuidManaged: {},
    }

    // There is a cached app but it will be ignored
    vi.mocked(getAppIdentifiers).mockReturnValue({app: APP2.apiKey})
    vi.mocked(fetchAppDetailsFromApiKey).mockResolvedValueOnce(APP2)
    vi.mocked(ensureDeploymentIdsPresence).mockResolvedValue(identifiers)
    vi.mocked(loadApp).mockResolvedValue(app)
    const writeAppConfigurationFileSpy = vi
      .spyOn(writeAppConfigurationFile, 'writeAppConfigurationFile')
      .mockResolvedValue()

    const opts = options(app)
    opts.reset = true

    // When
    const got = await ensureDeployContext(opts)

    // Then
    expect(fetchOrganizations).toHaveBeenCalledWith(testPartnersUserSession)
    expect(selectOrCreateApp).toHaveBeenCalledWith(
      app.name,
      {nodes: [APP1, APP2], pageInfo: {hasNextPage: false}},
      ORG1,
      testPartnersUserSession,
      DEFAULT_SELECT_APP_OPTIONS,
    )
    expect(updateAppIdentifiers).toBeCalledWith({
      app,
      identifiers,
      command: 'deploy',
    })
    expect(got.partnersApp.id).toEqual(APP1.id)
    expect(got.partnersApp.title).toEqual(APP1.title)
    expect(got.partnersApp.appType).toEqual(APP1.appType)
    expect(got.identifiers).toEqual({app: APP1.apiKey, extensions: {}, extensionIds: {}, extensionsNonUuidManaged: {}})
    expect(got.release).toEqual(true)
    writeAppConfigurationFileSpy.mockRestore()
  })
  test('load the app extension using the remote extensions specifications', async () => {
    // Given
    const app = testApp()
    const identifiers = {
      app: APP2.apiKey,
      extensions: {},
      extensionIds: {},
      extensionsNonUuidManaged: {},
    }

    const appWithExtensions = testApp({
      allExtensions: [await testAppConfigExtensions()],
    })
    vi.mocked(getAppIdentifiers).mockReturnValue({app: APP2.apiKey})
    vi.mocked(fetchAppDetailsFromApiKey).mockResolvedValueOnce(APP2)
    vi.mocked(ensureDeploymentIdsPresence).mockResolvedValue(identifiers)
    vi.mocked(loadApp).mockResolvedValue(appWithExtensions)
    vi.mocked(updateAppIdentifiers).mockResolvedValue(appWithExtensions)

    // When
    const got = await ensureDeployContext(options(app))

    // Then
    expect(selectOrCreateApp).not.toHaveBeenCalled()
    expect(got.partnersApp.id).toEqual(APP2.id)
    expect(got.partnersApp.title).toEqual(APP2.title)
    expect(got.partnersApp.appType).toEqual(APP2.appType)
    expect(got.identifiers).toEqual(identifiers)
    expect(got.release).toEqual(true)
    expect(got.app.allExtensions).toEqual(appWithExtensions.allExtensions)

    expect(metadata.getAllPublicMetadata()).toMatchObject({api_key: APP2.apiKey, partner_id: 1})
  })
  test('prompts the user to include the configuration and persist the flag if the flag is not present and the beta is enabled', async () => {
    // Given
    const app = testAppWithConfig({config: {client_id: APP2.apiKey}})
    setPathValue(app, 'remoteBetaFlags', [BetaFlag.VersionedAppConfig])
    const identifiers = {
      app: APP2.apiKey,
      extensions: {},
      extensionIds: {},
      extensionsNonUuidManaged: {},
    }
    vi.mocked(getAppIdentifiers).mockReturnValue({app: undefined})
    vi.mocked(fetchAppDetailsFromApiKey).mockResolvedValueOnce(APP2)
    vi.mocked(ensureDeploymentIdsPresence).mockResolvedValue(identifiers)
    vi.mocked(loadApp).mockResolvedValue(app)
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
    vi.mocked(getAppConfigurationFileName).mockReturnValue('shopify.app.toml')
    const writeAppConfigurationFileSpy = vi
      .spyOn(writeAppConfigurationFile, 'writeAppConfigurationFile')
      .mockResolvedValue()
    const metadataSpyOn = vi.spyOn(metadata, 'addPublicMetadata').mockImplementation(async () => {})

    // When
    await ensureDeployContext(options(app))

    // Then
    expect(metadataSpyOn).toHaveBeenNthCalledWith(2, expect.any(Function))
    expect(metadataSpyOn.mock.calls[1]![0]()).toEqual({cmd_deploy_confirm_include_config_used: true})

    expect(renderConfirmationPrompt).toHaveBeenCalled()
    expect(writeAppConfigurationFileSpy).toHaveBeenCalledWith(
      {...app.configuration, build: {include_config_on_deploy: true}},
      app.configSchema,
    )
    expect(renderInfo).toHaveBeenCalledWith({
      body: [
        {
          list: {
            items: ['Org:             org1', 'App:             app2'],
          },
        },
        '\n',
        'You can pass',
        {
          command: '--reset',
        },
        'to your command to reset your app configuration.',
      ],
      headline: 'Using shopify.app.toml:',
    })
    writeAppConfigurationFileSpy.mockRestore()
  })
  test('prompts the user to include the configuration and set it to false when not confirmed if the flag is not present and the beta is enabled', async () => {
    // Given
    const app = testAppWithConfig({config: {client_id: APP2.apiKey}})
    setPathValue(app, 'remoteBetaFlags', [BetaFlag.VersionedAppConfig])
    const identifiers = {
      app: APP2.apiKey,
      extensions: {},
      extensionIds: {},
      extensionsNonUuidManaged: {},
    }
    vi.mocked(getAppIdentifiers).mockReturnValue({app: undefined})
    vi.mocked(fetchAppDetailsFromApiKey).mockResolvedValueOnce(APP2)
    vi.mocked(ensureDeploymentIdsPresence).mockResolvedValue(identifiers)
    vi.mocked(loadApp).mockResolvedValue(app)
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)
    vi.mocked(getAppConfigurationFileName).mockReturnValue('shopify.app.toml')
    const writeAppConfigurationFileSpy = vi
      .spyOn(writeAppConfigurationFile, 'writeAppConfigurationFile')
      .mockResolvedValue()

    // When
    await ensureDeployContext(options(app))

    // Then
    expect(renderConfirmationPrompt).toHaveBeenCalled()
    expect(writeAppConfigurationFileSpy).toHaveBeenCalledWith(
      {...app.configuration, build: {include_config_on_deploy: false}},
      app.configSchema,
    )
    expect(renderInfo).toHaveBeenCalledWith({
      body: [
        {
          list: {
            items: ['Org:             org1', 'App:             app2'],
          },
        },
        '\n',
        'You can pass',
        {
          command: '--reset',
        },
        'to your command to reset your app configuration.',
      ],
      headline: 'Using shopify.app.toml:',
    })
    writeAppConfigurationFileSpy.mockRestore()
  })
  test('doesnt prompt the user to include the configuration and display the current value if the flag and beta are enabled', async () => {
    // Given
    const app = testAppWithConfig({config: {client_id: APP2.apiKey, build: {include_config_on_deploy: true}}})
    setPathValue(app, 'remoteBetaFlags', [BetaFlag.VersionedAppConfig])
    const identifiers = {
      app: APP2.apiKey,
      extensions: {},
      extensionIds: {},
      extensionsNonUuidManaged: {},
    }
    vi.mocked(getAppIdentifiers).mockReturnValue({app: undefined})
    vi.mocked(fetchAppDetailsFromApiKey).mockResolvedValueOnce(APP2)
    vi.mocked(ensureDeploymentIdsPresence).mockResolvedValue(identifiers)
    vi.mocked(loadApp).mockResolvedValue(app)
    vi.mocked(getAppConfigurationFileName).mockReturnValue('shopify.app.toml')
    const writeAppConfigurationFileSpy = vi
      .spyOn(writeAppConfigurationFile, 'writeAppConfigurationFile')
      .mockResolvedValue()
    const metadataSpyOn = vi.spyOn(metadata, 'addPublicMetadata').mockImplementation(async () => {})

    // When
    await ensureDeployContext(options(app))

    // Then
    expect(metadataSpyOn).toHaveBeenNthCalledWith(2, expect.any(Function))
    expect(metadataSpyOn.mock.calls[1]![0]()).toEqual(
      expect.not.objectContaining({cmd_deploy_confirm_include_config_used: expect.anything()}),
    )

    expect(renderConfirmationPrompt).not.toHaveBeenCalled()
    expect(writeAppConfigurationFileSpy).not.toHaveBeenCalled()
    expect(renderInfo).toHaveBeenCalledWith({
      body: [
        {
          list: {
            items: ['Org:             org1', 'App:             app2', 'Include config:  Yes'],
          },
        },
        '\n',
        'You can pass',
        {
          command: '--reset',
        },
        'to your command to reset your app configuration.',
      ],
      headline: 'Using shopify.app.toml:',
    })
    writeAppConfigurationFileSpy.mockRestore()
  })
  test('prompts the user to include the configuration when reset is used if the flag and beta are enabled', async () => {
    // Given
    const app = testAppWithConfig({config: {client_id: APP2.apiKey, build: {include_config_on_deploy: true}}})
    setPathValue(app, 'remoteBetaFlags', [BetaFlag.VersionedAppConfig])
    const identifiers = {
      app: APP2.apiKey,
      extensions: {},
      extensionIds: {},
      extensionsNonUuidManaged: {},
    }
    vi.mocked(getAppIdentifiers).mockReturnValue({app: undefined})
    vi.mocked(fetchAppDetailsFromApiKey).mockResolvedValueOnce(APP2)
    vi.mocked(ensureDeploymentIdsPresence).mockResolvedValue(identifiers)
    vi.mocked(loadApp).mockResolvedValue(app)
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)
    vi.mocked(getAppConfigurationFileName).mockReturnValue('shopify.app.toml')
    vi.mocked(link).mockResolvedValue(app.configuration)
    const writeAppConfigurationFileSpy = vi
      .spyOn(writeAppConfigurationFile, 'writeAppConfigurationFile')
      .mockResolvedValue()
    const metadataSpyOn = vi.spyOn(metadata, 'addPublicMetadata').mockImplementation(async () => {})

    // When
    await ensureDeployContext(options(app, true))

    // Then
    expect(metadataSpyOn).toHaveBeenNthCalledWith(2, expect.any(Function))
    expect(metadataSpyOn.mock.calls[1]![0]()).toEqual({cmd_deploy_confirm_include_config_used: false})

    expect(renderConfirmationPrompt).toHaveBeenCalled()
    expect(writeAppConfigurationFileSpy).toHaveBeenCalledWith(
      {...app.configuration, build: {include_config_on_deploy: false}},
      app.configSchema,
    )
    expect(renderInfo).toHaveBeenCalledWith({
      body: [
        {
          list: {
            items: ['Org:             org1', 'App:             app2'],
          },
        },
        '\n',
        'You can pass',
        {
          command: '--reset',
        },
        'to your command to reset your app configuration.',
      ],
      headline: 'Using shopify.app.toml:',
    })
    writeAppConfigurationFileSpy.mockRestore()
  })
  test('doesnt prompt the user to include the configuration when force is used if the flag is not present and beta are enabled', async () => {
    // Given
    const app = testAppWithConfig({config: {client_id: APP2.apiKey}})
    setPathValue(app, 'remoteBetaFlags', [BetaFlag.VersionedAppConfig])
    const identifiers = {
      app: APP2.apiKey,
      extensions: {},
      extensionIds: {},
      extensionsNonUuidManaged: {},
    }
    vi.mocked(getAppIdentifiers).mockReturnValue({app: undefined})
    vi.mocked(fetchAppDetailsFromApiKey).mockResolvedValueOnce(APP2)
    vi.mocked(ensureDeploymentIdsPresence).mockResolvedValue(identifiers)
    vi.mocked(loadApp).mockResolvedValue(app)
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)
    vi.mocked(getAppConfigurationFileName).mockReturnValue('shopify.app.toml')
    const writeAppConfigurationFileSpy = vi
      .spyOn(writeAppConfigurationFile, 'writeAppConfigurationFile')
      .mockResolvedValue()

    // When
    await ensureDeployContext(options(app, false, true))

    // Then
    expect(renderConfirmationPrompt).not.toHaveBeenCalled()
    expect(writeAppConfigurationFileSpy).not.toHaveBeenCalled()
    expect(renderInfo).toHaveBeenCalledWith({
      body: [
        {
          list: {
            items: ['Org:             org1', 'App:             app2', 'Include config:  No'],
          },
        },
        '\n',
        'You can pass',
        {
          command: '--reset',
        },
        'to your command to reset your app configuration.',
      ],
      headline: 'Using shopify.app.toml:',
    })
    writeAppConfigurationFileSpy.mockRestore()
  })
  test('prompt the user to include the configuration when force is used  if the flag and beta are enabled', async () => {
    // Given
    const app = testAppWithConfig({config: {client_id: APP2.apiKey, build: {include_config_on_deploy: true}}})
    setPathValue(app, 'remoteBetaFlags', [BetaFlag.VersionedAppConfig])
    const identifiers = {
      app: APP2.apiKey,
      extensions: {},
      extensionIds: {},
      extensionsNonUuidManaged: {},
    }
    vi.mocked(getAppIdentifiers).mockReturnValue({app: undefined})
    vi.mocked(fetchAppDetailsFromApiKey).mockResolvedValueOnce(APP2)
    vi.mocked(ensureDeploymentIdsPresence).mockResolvedValue(identifiers)
    vi.mocked(loadApp).mockResolvedValue(app)
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)
    vi.mocked(getAppConfigurationFileName).mockReturnValue('shopify.app.toml')
    const writeAppConfigurationFileSpy = vi
      .spyOn(writeAppConfigurationFile, 'writeAppConfigurationFile')
      .mockResolvedValue()

    // When
    await ensureDeployContext(options(app, false, true))

    // Then
    expect(renderConfirmationPrompt).not.toHaveBeenCalled()
    expect(writeAppConfigurationFileSpy).not.toHaveBeenCalled()
    expect(renderInfo).toHaveBeenCalledWith({
      body: [
        {
          list: {
            items: ['Org:             org1', 'App:             app2', 'Include config:  Yes'],
          },
        },
        '\n',
        'You can pass',
        {
          command: '--reset',
        },
        'to your command to reset your app configuration.',
      ],
      headline: 'Using shopify.app.toml:',
    })
    writeAppConfigurationFileSpy.mockRestore()
  })
  test('doesnt prompt the user to include the configuration regardless the value of the flag is the beta is not enabled', async () => {
    // Given
    const app = testAppWithConfig({config: {client_id: APP2.apiKey}})
    const identifiers = {
      app: APP2.apiKey,
      extensions: {},
      extensionIds: {},
      extensionsNonUuidManaged: {},
    }
    vi.mocked(getAppIdentifiers).mockReturnValue({app: undefined})
    vi.mocked(fetchAppDetailsFromApiKey).mockResolvedValueOnce(APP2)
    vi.mocked(ensureDeploymentIdsPresence).mockResolvedValue(identifiers)
    vi.mocked(loadApp).mockResolvedValue(app)
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)
    vi.mocked(getAppConfigurationFileName).mockReturnValue('shopify.app.toml')
    const writeAppConfigurationFileSpy = vi
      .spyOn(writeAppConfigurationFile, 'writeAppConfigurationFile')
      .mockResolvedValue()

    // When
    await ensureDeployContext(options(app, false, true))

    // Then
    // Then
    expect(renderConfirmationPrompt).not.toHaveBeenCalled()
    expect(writeAppConfigurationFileSpy).not.toHaveBeenCalled()
    expect(renderInfo).toHaveBeenCalledWith({
      body: [
        {
          list: {
            items: ['Org:             org1', 'App:             app2'],
          },
        },
        '\n',
        'You can pass',
        {
          command: '--reset',
        },
        'to your command to reset your app configuration.',
      ],
      headline: 'Using shopify.app.toml:',
    })
    writeAppConfigurationFileSpy.mockRestore()
  })
})

describe('ensureDraftExtensionsPushContext', () => {
  test("fetches the app from the partners' API and returns it alongside the id when identifiers are available locally and the app has no extensions", async () => {
    // Given
    const app = testApp()
    const identifiers = {
      app: APP2.apiKey,
      extensions: {},
      extensionIds: {},
      extensionsNonUuidManaged: {},
    }

    vi.spyOn(loadSpecifications, 'loadLocalExtensionsSpecifications').mockResolvedValue([])
    vi.mocked(loadApp).mockResolvedValue(app)
    vi.mocked(getAppIdentifiers).mockReturnValueOnce({app: APP2.apiKey})
    vi.mocked(fetchAppDetailsFromApiKey).mockResolvedValueOnce(APP2)
    vi.mocked(ensureDeploymentIdsPresence).mockResolvedValue(identifiers)

    // When
    const got = await ensureDraftExtensionsPushContext(draftExtensionsPushOptions(app))

    // Then
    expect(selectOrCreateApp).not.toHaveBeenCalled()
    expect(got.remoteApp.id).toEqual(APP2.id)
    expect(got.remoteApp.title).toEqual(APP2.title)
    expect(got.remoteApp.appType).toEqual(APP2.appType)
    expect(got.remoteExtensionIds).toEqual(identifiers.extensionIds)

    expect(metadata.getAllPublicMetadata()).toMatchObject({api_key: APP2.apiKey, partner_id: 1})
  })

  test("fetches the app from the partners' API and returns it alongside the id when there are no identifiers but user chooses to reuse dev store.cliKitStore()", async () => {
    // Given
    const app = testApp()
    const identifiers = {
      app: APP2.apiKey,
      extensions: {},
      extensionIds: {},
      extensionsNonUuidManaged: {},
    }
    vi.spyOn(loadSpecifications, 'loadLocalExtensionsSpecifications').mockResolvedValue([])
    vi.mocked(loadApp).mockResolvedValue(app)
    vi.mocked(getAppIdentifiers).mockReturnValue({app: undefined})
    vi.mocked(getCachedAppInfo).mockReturnValue(CACHED1)
    vi.mocked(fetchAppDetailsFromApiKey).mockResolvedValueOnce(APP2)
    vi.mocked(ensureDeploymentIdsPresence).mockResolvedValue(identifiers)
    vi.mocked(reuseDevConfigPrompt).mockResolvedValueOnce(true)

    // When
    const got = await ensureDraftExtensionsPushContext(draftExtensionsPushOptions(app))

    // Then
    expect(selectOrCreateApp).not.toHaveBeenCalled()
    expect(reuseDevConfigPrompt).toHaveBeenCalled()
    expect(got.remoteApp.id).toEqual(APP2.id)
    expect(got.remoteApp.title).toEqual(APP2.title)
    expect(got.remoteApp.appType).toEqual(APP2.appType)
    expect(got.remoteExtensionIds).toEqual(identifiers.extensionIds)
  })

  test("fetches the app from the partners' API and returns it alongside the id when config as code is enabled", async () => {
    // Given
    const app = testAppWithConfig({config: {client_id: APP2.apiKey}})
    const identifiers = {
      app: APP2.apiKey,
      extensions: {},
      extensionIds: {},
      extensionsNonUuidManaged: {},
    }
    vi.spyOn(loadSpecifications, 'loadLocalExtensionsSpecifications').mockResolvedValue([])
    vi.mocked(loadApp).mockResolvedValue(app)
    vi.mocked(getAppIdentifiers).mockReturnValue({app: undefined})
    vi.mocked(fetchAppDetailsFromApiKey).mockResolvedValueOnce(APP2)
    vi.mocked(ensureDeploymentIdsPresence).mockResolvedValue(identifiers)

    // When
    const got = await ensureDraftExtensionsPushContext(draftExtensionsPushOptions(app))

    // Then
    expect(selectOrCreateApp).not.toHaveBeenCalled()
    expect(reuseDevConfigPrompt).not.toHaveBeenCalled()
    expect(fetchAppDetailsFromApiKey).toHaveBeenCalledWith(APP2.apiKey, 'token')
    expect(got.remoteApp.id).toEqual(APP2.id)
    expect(got.remoteApp.title).toEqual(APP2.title)
    expect(got.remoteApp.appType).toEqual(APP2.appType)
    expect(got.remoteExtensionIds).toEqual(identifiers.extensionIds)
  })

  test('prompts the user to create or select an app and returns it with its id when the app has no extensions', async () => {
    // Given
    const app = testApp()
    const identifiers = {
      app: APP1.apiKey,
      extensions: {},
      extensionIds: {},
      extensionsNonUuidManaged: {},
    }
    vi.spyOn(loadSpecifications, 'loadLocalExtensionsSpecifications').mockResolvedValue([])
    vi.mocked(loadApp).mockResolvedValue(app)
    vi.mocked(getAppIdentifiers).mockReturnValue({app: undefined})
    vi.mocked(fetchAppDetailsFromApiKey).mockResolvedValueOnce(APP2)
    vi.mocked(ensureDeploymentIdsPresence).mockResolvedValue(identifiers)
    // When
    const got = await ensureDraftExtensionsPushContext(draftExtensionsPushOptions(app))

    // Then
    expect(fetchOrganizations).toHaveBeenCalledWith(testPartnersUserSession)
    expect(selectOrCreateApp).toHaveBeenCalledWith(
      app.name,
      {nodes: [APP1, APP2], pageInfo: {hasNextPage: false}},
      ORG1,
      testPartnersUserSession,
      DEFAULT_SELECT_APP_OPTIONS,
    )
    expect(got.remoteApp.id).toEqual(APP1.id)
    expect(got.remoteApp.title).toEqual(APP1.title)
    expect(got.remoteApp.appType).toEqual(APP1.appType)
  })

  test("throws an app not found error if the app with the Client ID doesn't exist", async () => {
    // Given
    const app = testApp()
    vi.spyOn(loadSpecifications, 'loadLocalExtensionsSpecifications').mockResolvedValue([])
    vi.mocked(loadApp).mockResolvedValue(app)
    vi.mocked(getAppIdentifiers).mockReturnValue({app: APP1.apiKey})
    vi.mocked(fetchAppDetailsFromApiKey).mockResolvedValueOnce(undefined)

    // When
    await expect(ensureDraftExtensionsPushContext(draftExtensionsPushOptions(app))).rejects.toThrow(
      /Couldn't find the app with Client ID key1/,
    )
  })

  test('prompts the user to create or select an app if reset is true', async () => {
    // Given
    const app = testApp()
    const identifiers = {
      app: APP1.apiKey,
      extensions: {},
      extensionIds: {},
      extensionsNonUuidManaged: {},
    }

    vi.spyOn(loadSpecifications, 'loadLocalExtensionsSpecifications').mockResolvedValue([])
    vi.mocked(loadApp).mockResolvedValue(app)
    // There is a cached app but it will be ignored
    vi.mocked(getAppIdentifiers).mockReturnValue({app: APP2.apiKey})
    vi.mocked(fetchAppDetailsFromApiKey).mockResolvedValueOnce(APP2)
    vi.mocked(ensureDeploymentIdsPresence).mockResolvedValue(identifiers)

    const opts = draftExtensionsPushOptions(app)
    opts.reset = true

    // When
    const got = await ensureDraftExtensionsPushContext(opts)

    // Then
    expect(fetchOrganizations).toHaveBeenCalledWith(testPartnersUserSession)
    expect(selectOrCreateApp).toHaveBeenCalledWith(
      app.name,
      {nodes: [APP1, APP2], pageInfo: {hasNextPage: false}},
      ORG1,
      testPartnersUserSession,
      DEFAULT_SELECT_APP_OPTIONS,
    )
    expect(got.remoteApp.id).toEqual(APP1.id)
    expect(got.remoteApp.title).toEqual(APP1.title)
    expect(got.remoteApp.appType).toEqual(APP1.appType)
    expect(got.remoteExtensionIds).toEqual(identifiers.extensionIds)
  })
})

describe('ensureReleaseContext', () => {
  test('updates app identifiers', async () => {
    // Given
    const app = testApp()
    vi.mocked(getAppIdentifiers).mockReturnValue({app: APP2.apiKey})
    vi.mocked(fetchAppDetailsFromApiKey).mockResolvedValueOnce(APP2)
    vi.mocked(updateAppIdentifiers).mockResolvedValue(app)

    // When
    const got = await ensureReleaseContext({
      app,
      apiKey: 'key2',
      reset: false,
      force: false,
      commandConfig: COMMAND_CONFIG,
    })

    // Then
    expect(updateAppIdentifiers).toBeCalledWith({
      app,
      identifiers: {
        app: APP2.apiKey,
      },
      command: 'release',
    })

    expect(got.app).toEqual(app)
    expect(got.partnersApp).toEqual(APP2)
    expect(got.token).toEqual('token')
  })
})

describe('ensureThemeExtensionDevContext', () => {
  test('fetches theme extension when it exists', async () => {
    // Given
    const token = 'token'
    const apiKey = 'apiKey'
    const extension = await testThemeExtensions()

    vi.mocked(fetchAppExtensionRegistrations).mockResolvedValue({
      app: {
        extensionRegistrations: [
          {
            id: 'other ID',
            uuid: 'other UUID',
            title: 'other extension',
            type: 'other',
          },
          {
            id: 'existing ID',
            uuid: 'UUID',
            title: 'theme app extension',
            type: 'THEME_APP_EXTENSION',
          },
        ],
        configurationRegistrations: [],
        dashboardManagedExtensionRegistrations: [],
      },
    })

    // When
    const got = await ensureThemeExtensionDevContext(extension, apiKey, token)

    // Then
    expect('existing ID').toEqual(got.id)
    expect('UUID').toEqual(got.uuid)
    expect('theme app extension').toEqual(got.title)
    expect('THEME_APP_EXTENSION').toEqual(got.type)
  })

  test('creates theme extension when it does not exist', async () => {
    // Given
    const token = 'token'
    const apiKey = 'apiKey'
    const extension = await testThemeExtensions()

    vi.mocked(fetchAppExtensionRegistrations).mockResolvedValue({
      app: {extensionRegistrations: [], configurationRegistrations: [], dashboardManagedExtensionRegistrations: []},
    })
    vi.mocked(createExtension).mockResolvedValue({
      id: 'new ID',
      uuid: 'UUID',
      title: 'theme app extension',
      type: 'THEME_APP_EXTENSION',
    })

    // When
    const got = await ensureThemeExtensionDevContext(extension, apiKey, token)

    // Then
    expect('new ID').toEqual(got.id)
    expect('UUID').toEqual(got.uuid)
    expect('theme app extension').toEqual(got.title)
    expect('THEME_APP_EXTENSION').toEqual(got.type)
  })
})

describe('ensureVersionsListContext', () => {
  test('returns the partners token and app', async () => {
    // Given
    const app = testApp()
    vi.mocked(fetchAppDetailsFromApiKey).mockResolvedValueOnce(APP2)

    // When
    const got = await ensureVersionsListContext({
      app,
      apiKey: 'key1',
      reset: false,
      commandConfig: COMMAND_CONFIG,
    })

    // Then
    expect(got).toEqual({
      partnersApp: APP2,
      partnersSession: testPartnersUserSession,
    })
  })
})

async function mockApp(directory: string, app?: Partial<AppInterface>) {
  const versionSchema = await buildVersionedAppSchema()
  const localApp = testApp(app)
  localApp.configSchema = versionSchema.schema
  localApp.specifications = versionSchema.configSpecifications
  localApp.directory = directory
  return localApp
}
