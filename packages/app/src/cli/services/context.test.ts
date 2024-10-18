import {fetchOrganizations, fetchOrgFromId, fetchStoreByDomain} from './dev/fetch.js'
import {selectOrCreateApp} from './dev/select-app.js'
import {selectStore, convertToTransferDisabledStoreIfNeeded} from './dev/select-store.js'
import {ensureDeploymentIdsPresence} from './context/identifiers.js'
import {DevContextOptions, ensureDevContext, ensureDeployContext, ensureThemeExtensionDevContext} from './context.js'
import {createExtension} from './dev/create-extension.js'
import {CachedAppInfo, clearCachedAppInfo, getCachedAppInfo, setCachedAppInfo} from './local-storage.js'
import link from './app/config/link.js'
import {fetchSpecifications} from './generate/fetch-extension-specifications.js'
import * as patchAppConfigurationFile from './app/patch-app-configuration-file.js'
import {DeployOptions} from './deploy.js'
import {
  MinimalAppIdentifiers,
  Organization,
  OrganizationApp,
  OrganizationSource,
  OrganizationStore,
} from '../models/organization.js'
import {getAppIdentifiers} from '../models/app/identifiers.js'
import {selectOrganizationPrompt} from '../prompts/dev.js'
import {
  DEFAULT_CONFIG,
  testDeveloperPlatformClient,
  testApp,
  testAppWithConfig,
  testOrganizationApp,
  testThemeExtensions,
  buildVersionedAppSchema,
} from '../models/app/app.test-data.js'
import metadata from '../metadata.js'
import {
  AppConfigurationStateLinked,
  getAppConfigurationFileName,
  isWebType,
  loadApp,
  loadAppConfiguration,
} from '../models/app/loader.js'
import {AppInterface, AppLinkedInterface, CurrentAppConfiguration} from '../models/app/app.js'
import * as loadSpecifications from '../models/extensions/load-specifications.js'
import {DeveloperPlatformClient, selectDeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {RemoteAwareExtensionSpecification} from '../models/extensions/specification.js'
import {afterEach, beforeAll, beforeEach, describe, expect, test, vi} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {getPackageManager} from '@shopify/cli-kit/node/node-package-manager'
import {inTemporaryDirectory, readFile, writeFileSync} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {renderConfirmationPrompt, renderInfo, renderTasks, Task} from '@shopify/cli-kit/node/ui'
import {Config} from '@oclif/core'

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
  source: OrganizationSource.Partners,
}
const ORG2: Organization = {
  id: '2',
  businessName: 'org2',
  source: OrganizationSource.Partners,
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

const devOptions = (options: object = {}): DevContextOptions => {
  return {
    directory: 'app_directory',
    reset: false,
    developerPlatformClient: buildDeveloperPlatformClient({
      appFromId: () => Promise.resolve(APP2),
    }),
    ...options,
  }
}

const ORG_AND_APPS_RESPONSE = {
  organization: ORG1,
  apps: [APP1, APP2],
  hasMorePages: false,
  developerPlatformClient: buildDeveloperPlatformClient(),
}

const DEFAULT_SELECT_APP_OPTIONS = {
  directory: undefined,
  isLaunchable: true,
  scopesArray: [],
}

const state: AppConfigurationStateLinked = {
  state: 'connected-app',
  basicConfiguration: {
    ...DEFAULT_CONFIG,
    path: 'shopify.app.toml',
    client_id: APP2.apiKey,
  },
  appDirectory: 'tmp',
  configurationPath: 'shopify.app.toml',
  configSource: 'flag',
  configurationFileName: 'shopify.app.toml',
}

const remoteApp: OrganizationApp = APP1

const deployOptions = (app: AppLinkedInterface, reset = false, force = false): DeployOptions => {
  return {
    app,
    remoteApp: APP2,
    organization: ORG1,
    reset,
    force,
    noRelease: false,
    developerPlatformClient: buildDeveloperPlatformClient(),
  }
}

function buildDeveloperPlatformClient(extras?: Partial<DeveloperPlatformClient>): DeveloperPlatformClient {
  return testDeveloperPlatformClient({
    ...extras,
    async appFromId({apiKey}: MinimalAppIdentifiers) {
      for (const app of [APP1, APP2]) {
        if (apiKey === app.apiKey) return app
      }
      throw new Error(`Unexpected client id: ${apiKey}`)
    },
    async appsForOrg(orgId: string) {
      if (orgId !== ORG1.id) {
        throw new Error(`Unexpected org id: ${orgId}`)
      }
      return {
        apps: [APP1, APP2],
        hasMorePages: false,
      }
    },
  })
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
vi.mock('../utilities/developer-platform-client.js')

beforeAll(async () => {
  const localSpecs = await loadSpecifications.loadLocalExtensionsSpecifications()
  const mockedRemoteSpecs = localSpecs.map((spec) => ({
    ...spec,
    loadedRemoteSpecs: true,
  })) as RemoteAwareExtensionSpecification[]
  vi.mocked(fetchSpecifications).mockResolvedValue(mockedRemoteSpecs)
})

beforeEach(async () => {
  vi.mocked(getAppIdentifiers).mockReturnValue({app: undefined})
  vi.mocked(selectOrganizationPrompt).mockResolvedValue(ORG1)
  vi.mocked(selectOrCreateApp).mockResolvedValue(APP1)
  vi.mocked(selectStore).mockResolvedValue(STORE1)
  vi.mocked(fetchOrganizations).mockResolvedValue([ORG1, ORG2])
  vi.mocked(fetchOrgFromId).mockResolvedValue(ORG1)
  vi.mocked(getPackageManager).mockResolvedValue('npm')
  vi.mocked(isWebType).mockReturnValue(true)
  vi.mocked(link).mockResolvedValue({
    configuration: testAppWithConfig({config: {path: 'shopify.app.toml', client_id: APP2.apiKey}}).configuration,
    remoteApp: APP2,
    state,
  })

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
      specifications: [],
      remoteFlags: [],
    })
  })

  test('returns selected data using config file set in cache', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      vi.mocked(selectDeveloperPlatformClient).mockReturnValue(buildDeveloperPlatformClient())
      vi.mocked(getCachedAppInfo).mockReturnValue(CACHED1_WITH_CONFIG)
      const patchAppConfigurationFileSpy = vi
        .spyOn(patchAppConfigurationFile, 'patchAppConfigurationFile')
        .mockResolvedValue()
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
        specifications: [],
        remoteFlags: [],
      })
      vi.mocked(fetchStoreByDomain).mockResolvedValue({organization: ORG1, store: STORE1})
      const app = await mockApp(tmp, localApp)
      vi.mocked(loadApp).mockResolvedValue(app)
      const options = devOptions()

      // When
      const got = await ensureDevContext(options)

      // Then
      expect(got).toEqual({
        remoteApp: {...APP2, apiSecret: 'secret2'},
        storeFqdn: STORE1.shopDomain,
        storeId: STORE1.shopId,
        remoteAppUpdated: true,
        updateURLs: true,
        localApp: app,
        organization: 'org1',
        configFile: 'shopify.app.toml',
      })
      expect(setCachedAppInfo).not.toHaveBeenCalled()

      expect(metadata.getAllPublicMetadata()).toMatchObject({
        api_key: APP2.apiKey,
        partner_id: 1,
      })
      patchAppConfigurationFileSpy.mockRestore()
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
        specifications: [],
        remoteFlags: [],
      })
      vi.mocked(fetchStoreByDomain).mockResolvedValue({organization: ORG1, store: STORE1})
      const options = devOptions({apiKey: APP2.apiKey})
      vi.mocked(selectDeveloperPlatformClient).mockReturnValue(options.developerPlatformClient)

      // When
      const got = await ensureDevContext(options)

      // Then
      expect(got).toEqual({
        remoteApp: {...APP2, apiSecret: 'secret2'},
        storeFqdn: STORE1.shopDomain,
        storeId: STORE1.shopId,
        remoteAppUpdated: true,
        updateURLs: true,
        organization: 'org1',
        configFile: 'shopify.app.toml',
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
      writeFileSync(joinPath(tmp, 'shopify.app.dev.toml'), '')
      vi.mocked(getCachedAppInfo).mockReturnValue(undefined)
      vi.mocked(loadAppConfiguration).mockReset()
      const localApp = {
        configuration: {
          path: joinPath(tmp, 'shopify.app.dev.toml'),
          name: 'my app',
          client_id: APP2.apiKey,
          scopes: 'write_products',
          webhooks: {api_version: '2023-04'},
          application_url: 'https://myapp.com',
        } as CurrentAppConfiguration,
      }
      const {schema: configSchema} = await buildVersionedAppSchema()
      vi.mocked(loadAppConfiguration).mockResolvedValue({
        directory: tmp,
        configuration: localApp.configuration,
        configSchema,
        specifications: [],
        remoteFlags: [],
      })
      vi.mocked(fetchStoreByDomain).mockResolvedValue({organization: ORG1, store: STORE1})
      const app = await mockApp(tmp, localApp)
      vi.mocked(loadApp).mockResolvedValue(app)
      const options = devOptions()
      vi.mocked(selectDeveloperPlatformClient).mockReturnValue(options.developerPlatformClient)

      // When
      await ensureDevContext(options)

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
      const tomlContent = `# Learn more about configuring your app at https://shopify.dev/docs/apps/tools/cli/configuration
client_id = "12345"
`
      writeFileSync(filePath, tomlContent)
      vi.mocked(loadAppConfiguration).mockReset()
      const {schema: configSchema} = await buildVersionedAppSchema()
      const localApp = {
        configuration: {
          ...DEFAULT_CONFIG,
          client_id: APP2.apiKey,
          path: joinPath(tmp, 'shopify.app.dev.toml'),
        } as CurrentAppConfiguration,
      }

      vi.mocked(loadAppConfiguration).mockResolvedValue({
        directory: tmp,
        configuration: localApp.configuration,
        configSchema,
        specifications: [],
        remoteFlags: [],
      })
      const app = await mockApp(tmp, localApp)
      vi.mocked(loadApp).mockResolvedValue(app)
      const options = devOptions()
      vi.mocked(selectDeveloperPlatformClient).mockReturnValue(options.developerPlatformClient)

      // When
      await ensureDevContext(options)

      // Then
      expect(selectStore).toHaveBeenCalled()
      const content = await readFile(joinPath(tmp, 'shopify.app.dev.toml'))
      const expectedContent = `# Learn more about configuring your app at https://shopify.dev/docs/apps/tools/cli/configuration

client_id = "12345"

[build]
dev_store_url = "domain1"
`
      expect(content).toEqual(expectedContent)
    })
  })

  test('shows the correct banner content when running for the first time with linked config file', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      writeFileSync(joinPath(tmp, 'shopify.app.toml'), '')
      vi.mocked(getCachedAppInfo).mockReturnValue(undefined)
      vi.mocked(loadAppConfiguration).mockReset()
      const {schema: configSchema} = await buildVersionedAppSchema()
      const localApp = {
        configuration: {
          ...DEFAULT_CONFIG,
          client_id: APP2.apiKey,
          path: joinPath(tmp, 'shopify.app.toml'),
        } as CurrentAppConfiguration,
      }
      vi.mocked(loadAppConfiguration).mockResolvedValue({
        directory: tmp,
        configuration: localApp.configuration,
        configSchema,
        specifications: [],
        remoteFlags: [],
      })

      vi.mocked(getAppConfigurationFileName).mockReturnValue('shopify.app.toml')
      vi.mocked(fetchStoreByDomain).mockResolvedValue({organization: ORG1, store: STORE1})
      const app = await mockApp(tmp, localApp)
      vi.mocked(loadApp).mockResolvedValue(app)
      const options = devOptions()
      vi.mocked(selectDeveloperPlatformClient).mockReturnValue(options.developerPlatformClient)

      // When
      await ensureDevContext(options)

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
          'You can pass ',
          {
            command: '--reset',
          },
          ' to your command to reset your app configuration.',
        ],
        headline: 'Using shopify.app.toml for default values:',
      })
    })
  })

  test('returns selected data and updates internal state, without cached state', async () => {
    // Given
    vi.mocked(getCachedAppInfo).mockReturnValue(undefined)
    const options = devOptions()
    vi.mocked(selectDeveloperPlatformClient).mockReturnValue(options.developerPlatformClient)

    // When
    const got = await ensureDevContext(options)

    // Then
    expect(got).toEqual({
      remoteApp: {...APP1, apiSecret: 'secret1'},
      storeFqdn: STORE1.shopDomain,
      storeId: STORE1.shopId,
      remoteAppUpdated: true,
      updateURLs: undefined,
      organization: 'org1',
    })
    expect(setCachedAppInfo).toHaveBeenNthCalledWith(1, {
      appId: APP1.apiKey,
      title: APP1.title,
      storeFqdn: STORE1.shopDomain,
      directory: options.directory,
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
    vi.mocked(fetchStoreByDomain).mockResolvedValue({organization: ORG1, store: STORE1})

    // When
    const options = devOptions({
      developerPlatformClient: buildDeveloperPlatformClient({
        appFromId: () => Promise.resolve(APP1),
      }),
    })
    const got = await ensureDevContext(options)

    // Then
    expect(got).toEqual({
      remoteApp: {...APP1, apiSecret: 'secret1'},
      storeFqdn: STORE1.shopDomain,
      storeId: STORE1.shopId,
      remoteAppUpdated: true,
      updateURLs: undefined,
      organization: 'org1',
      configFile: 'shopify.app.toml',
    })
  })

  test('returns selected data and updates internal state, with cached state', async () => {
    // Given
    vi.mocked(getCachedAppInfo).mockReturnValue({...CACHED1, previousAppId: APP1.apiKey})
    vi.mocked(fetchStoreByDomain).mockResolvedValue({organization: ORG1, store: STORE1})

    // When
    const options = devOptions({
      developerPlatformClient: buildDeveloperPlatformClient({
        appFromId: () => Promise.resolve(APP1),
        orgAndApps: () => Promise.resolve(ORG_AND_APPS_RESPONSE),
      }),
    })
    const got = await ensureDevContext(options)

    // Then
    expect(got).toEqual({
      remoteApp: {...APP1, apiSecret: 'secret1'},
      storeFqdn: STORE1.shopDomain,
      storeId: STORE1.shopId,
      remoteAppUpdated: false,
      updateURLs: undefined,
      organization: 'org1',
    })
    expect(fetchOrganizations).not.toHaveBeenCalled()
    expect(setCachedAppInfo).toHaveBeenNthCalledWith(1, {
      appId: APP1.apiKey,
      title: APP1.title,
      storeFqdn: STORE1.shopDomain,
      directory: options.directory,
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
        'You can pass ',
        {
          command: '--reset',
        },
        ' to your command to reset your app configuration.',
      ],
      headline: 'Using these settings:',
    })
    expect(options.developerPlatformClient.orgAndApps).not.toBeCalled()
  })

  test('suppresses info box when customLogInfoBox flag is passed', async () => {
    // Given
    vi.mocked(getCachedAppInfo).mockReturnValue({...CACHED1, previousAppId: APP1.apiKey})
    vi.mocked(fetchStoreByDomain).mockResolvedValue({organization: ORG1, store: STORE1})

    // When
    const options = devOptions({
      customInfoBox: true,
      storeFqdn: 'domain1',
      storeFqdns: ['domain1', 'domain2'],
      developerPlatformClient: buildDeveloperPlatformClient({
        appFromId: () => Promise.resolve(APP1),
        orgAndApps: () => Promise.resolve(ORG_AND_APPS_RESPONSE),
      }),
    })
    await ensureDevContext(options)

    // Then
    expect(renderInfo).not.toHaveBeenCalled()
  })

  test('returns selected data and updates internal state, with inputs from flags', async () => {
    // Given
    vi.mocked(getCachedAppInfo).mockReturnValue(undefined)
    vi.mocked(convertToTransferDisabledStoreIfNeeded).mockResolvedValueOnce(true)
    vi.mocked(fetchStoreByDomain).mockResolvedValue({organization: ORG1, store: STORE1})
    const options = devOptions({
      apiKey: 'key2',
      storeFqdn: 'domain1',
      developerPlatformClient: buildDeveloperPlatformClient({
        appFromId: () => Promise.resolve(APP2),
        orgAndApps: () => Promise.resolve(ORG_AND_APPS_RESPONSE),
      }),
    })
    vi.mocked(selectDeveloperPlatformClient).mockReturnValue(options.developerPlatformClient)

    // When
    const got = await ensureDevContext(options)

    // Then
    expect(got).toEqual({
      remoteApp: {...APP2, apiSecret: 'secret2'},
      storeFqdn: STORE1.shopDomain,
      storeId: STORE1.shopId,
      remoteAppUpdated: true,
      updateURLs: undefined,
      organization: 'org1',
    })
    expect(setCachedAppInfo).toHaveBeenNthCalledWith(1, {
      appId: APP2.apiKey,
      directory: options.directory,
      storeFqdn: STORE1.shopDomain,
      orgId: ORG1.id,
      title: APP2.title,
    })
    expect(fetchOrganizations).toBeCalled()
    expect(selectOrCreateApp).not.toBeCalled()
    expect(selectStore).not.toBeCalled()
    expect(options.developerPlatformClient.orgAndApps).not.toBeCalled()
  })

  test('throws if the store input is not valid', async () => {
    // Given
    vi.mocked(getCachedAppInfo).mockReturnValue(undefined)
    vi.mocked(fetchStoreByDomain).mockResolvedValue({organization: ORG1, store: undefined})
    const options = devOptions({
      apiKey: 'key1',
      storeFqdn: 'invalid_store_domain',
    })
    vi.mocked(selectDeveloperPlatformClient).mockReturnValue(options.developerPlatformClient)

    // When
    const got = ensureDevContext(options)

    // Then
    await expect(got).rejects.toThrow(/Could not find invalid_store_domain/)
  })

  test('resets cached state if reset is true', async () => {
    // Given
    vi.mocked(getCachedAppInfo).mockReturnValueOnce(CACHED1)
    const options = devOptions({reset: true})
    vi.mocked(selectDeveloperPlatformClient).mockReturnValue(options.developerPlatformClient)

    // When
    await ensureDevContext(options)

    // Then
    expect(clearCachedAppInfo).toHaveBeenCalledWith(options.directory)
    expect(options.developerPlatformClient.appsForOrg).toBeCalled()
    expect(link).toBeCalled()
  })

  test('reset triggers link if opted into config in code', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      writeFileSync(joinPath(tmp, 'shopify.app.dev.toml'), '')
      vi.mocked(getCachedAppInfo).mockReturnValueOnce(CACHED1_WITH_CONFIG)
      const filePath = joinPath(tmp, 'shopify.app.dev.toml')
      const localApp = {
        configuration: {
          ...DEFAULT_CONFIG,
          path: filePath,
          client_id: APP2.apiKey,
          name: APP2.apiKey,
          application_url: 'https://example.com',
          webhooks: {api_version: '2023-04'},
        } as CurrentAppConfiguration,
      }
      const {schema: configSchema} = await buildVersionedAppSchema()
      vi.mocked(loadAppConfiguration).mockResolvedValue({
        directory: tmp,
        configuration: localApp.configuration,
        configSchema,
        specifications: [],
        remoteFlags: [],
      })
      const app = await mockApp(tmp, localApp)
      vi.mocked(loadApp).mockResolvedValue(app)
      const options = devOptions({reset: true})
      vi.mocked(selectDeveloperPlatformClient).mockReturnValue(options.developerPlatformClient)

      // When
      const got = await ensureDevContext(options)

      // Then
      expect(link).toBeCalled()
      expect(got.remoteApp).toEqual({...APP2, apiSecret: 'secret2'})
    })
  })

  test('links an app when running dev for the first time', async () => {
    // Given
    const options = devOptions()
    vi.mocked(selectDeveloperPlatformClient).mockReturnValue(options.developerPlatformClient)

    // When
    await ensureDevContext(options)

    // Then
    expect(link).toBeCalled()
  })

  describe('when --json is in argv', () => {
    let originalArgv: string[]

    beforeEach(() => {
      originalArgv = process.argv
    })

    // Restore the original process.argv
    afterEach(() => {
      process.argv = originalArgv
    })

    test('Does not display used dev values when using json output', async () => {
      vi.mocked(getCachedAppInfo).mockReturnValue({...CACHED1, previousAppId: APP1.apiKey})
      vi.mocked(fetchStoreByDomain).mockResolvedValue({organization: ORG1, store: STORE1})

      // When
      const options = devOptions({
        developerPlatformClient: buildDeveloperPlatformClient({
          appFromId: () => Promise.resolve(APP1),
        }),
      })
      process.argv = ['', '', '--json']
      await ensureDevContext(options)

      expect(renderInfo).not.toBeCalled()
    })
  })

  test('links app if no app configs exist & cache has a current config file defined', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      writeFileSync(joinPath(tmp, 'shopify.app.toml'), '')
      vi.mocked(getCachedAppInfo).mockReturnValueOnce(CACHED1_WITH_CONFIG)
      const filePath = joinPath(tmp, 'shopify.app.toml')
      const {schema: configSchema} = await buildVersionedAppSchema()
      const localApp = {
        configuration: {
          ...DEFAULT_CONFIG,
          path: filePath,
          client_id: APP2.apiKey,
          name: APP2.apiKey,
          application_url: 'https://example.com',
          webhooks: {api_version: '2023-04'},
        } as CurrentAppConfiguration,
      }
      vi.mocked(loadAppConfiguration).mockResolvedValue({
        directory: tmp,
        configuration: localApp.configuration,
        configSchema,
        specifications: [],
        remoteFlags: [],
      })
      const app = await mockApp(tmp, localApp)
      vi.mocked(loadApp).mockResolvedValue(app)
      const options = devOptions()
      vi.mocked(selectDeveloperPlatformClient).mockReturnValue(options.developerPlatformClient)

      // When
      const got = await ensureDevContext(options)

      // Then
      expect(link).toBeCalled()
      expect(got.remoteApp).toEqual({...APP2, apiSecret: 'secret2'})
    })
  })
})

describe('ensureDeployContext', () => {
  test('prompts the user to include the configuration and persist the flag if the flag is not present', async () => {
    // Given
    const app = testAppWithConfig({config: {client_id: APP2.apiKey}})
    const identifiers = {
      app: APP2.apiKey,
      extensions: {},
      extensionIds: {},
      extensionsNonUuidManaged: {},
    }
    vi.mocked(getAppIdentifiers).mockReturnValue({app: undefined})
    vi.mocked(ensureDeploymentIdsPresence).mockResolvedValue(identifiers)
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
    vi.mocked(getAppConfigurationFileName).mockReturnValue('shopify.app.toml')

    const patchAppConfigurationFileSpy = vi
      .spyOn(patchAppConfigurationFile, 'patchAppConfigurationFile')
      .mockResolvedValue()
    const metadataSpyOn = vi.spyOn(metadata, 'addPublicMetadata').mockImplementation(async () => {})

    // When
    await ensureDeployContext(deployOptions(app))

    // Then
    expect(metadataSpyOn).toHaveBeenNthCalledWith(1, expect.any(Function))
    expect(metadataSpyOn.mock.calls[0]![0]()).toEqual({cmd_deploy_confirm_include_config_used: true})

    expect(renderConfirmationPrompt).toHaveBeenCalled()
    expect(patchAppConfigurationFileSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        path: app.configuration.path,
        patch: {
          build: {include_config_on_deploy: true},
        },
        schema: expect.any(Object),
      }),
    )
    expect(renderInfo).toHaveBeenCalledWith({
      body: [
        {
          list: {
            items: ['Org:             org1', 'App:             app2'],
          },
        },
        '\n',
        'You can pass ',
        {
          command: '--reset',
        },
        ' to your command to reset your app configuration.',
      ],
      headline: 'Using shopify.app.toml for default values:',
    })
    patchAppConfigurationFileSpy.mockRestore()
  })

  test('prompts the user to include the configuration and set it to false when not confirmed if the flag is not present', async () => {
    // Given
    const app = testAppWithConfig({config: {client_id: APP2.apiKey}})
    const identifiers = {
      app: APP2.apiKey,
      extensions: {},
      extensionIds: {},
      extensionsNonUuidManaged: {},
    }
    vi.mocked(ensureDeploymentIdsPresence).mockResolvedValue(identifiers)
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)
    vi.mocked(getAppConfigurationFileName).mockReturnValue('shopify.app.toml')
    const patchAppConfigurationFileSpy = vi
      .spyOn(patchAppConfigurationFile, 'patchAppConfigurationFile')
      .mockResolvedValue()

    // When
    await ensureDeployContext(deployOptions(app))

    // Then
    expect(renderConfirmationPrompt).toHaveBeenCalled()
    expect(patchAppConfigurationFileSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        path: app.configuration.path,
        patch: {
          build: {include_config_on_deploy: false},
        },
        schema: expect.any(Object),
      }),
    )
    expect(renderInfo).toHaveBeenCalledWith({
      body: [
        {
          list: {
            items: ['Org:             org1', 'App:             app2'],
          },
        },
        '\n',
        'You can pass ',
        {
          command: '--reset',
        },
        ' to your command to reset your app configuration.',
      ],
      headline: 'Using shopify.app.toml for default values:',
    })
    patchAppConfigurationFileSpy.mockRestore()
  })

  test('doesnt prompt the user to include the configuration and display the current value if the flag', async () => {
    // Given
    const app = testAppWithConfig({config: {client_id: APP2.apiKey, build: {include_config_on_deploy: true}}})
    const identifiers = {
      app: APP2.apiKey,
      extensions: {},
      extensionIds: {},
      extensionsNonUuidManaged: {},
    }
    vi.mocked(getAppIdentifiers).mockReturnValue({app: undefined})
    vi.mocked(ensureDeploymentIdsPresence).mockResolvedValue(identifiers)
    vi.mocked(loadApp).mockResolvedValue(app)
    vi.mocked(link).mockResolvedValue((app as any).configuration)
    // vi.mocked(selectDeveloperPlatformClient).mockReturnValue(testDeveloperPlatformClient)
    vi.mocked(getAppConfigurationFileName).mockReturnValue('shopify.app.toml')
    const patchAppConfigurationFileSpy = vi
      .spyOn(patchAppConfigurationFile, 'patchAppConfigurationFile')
      .mockResolvedValue()
    const metadataSpyOn = vi.spyOn(metadata, 'addPublicMetadata').mockImplementation(async () => {})

    const options = deployOptions(app)
    vi.mocked(selectDeveloperPlatformClient).mockReturnValue(options.developerPlatformClient)

    // When
    await ensureDeployContext(options)

    // Then
    expect(metadataSpyOn).not.toHaveBeenCalled()

    expect(renderConfirmationPrompt).not.toHaveBeenCalled()
    expect(patchAppConfigurationFileSpy).not.toHaveBeenCalled()
    expect(renderInfo).toHaveBeenCalledWith({
      body: [
        {
          list: {
            items: ['Org:             org1', 'App:             app2', 'Include config:  Yes'],
          },
        },
        '\n',
        'You can pass ',
        {
          command: '--reset',
        },
        ' to your command to reset your app configuration.',
      ],
      headline: 'Using shopify.app.toml for default values:',
    })
    patchAppConfigurationFileSpy.mockRestore()
  })

  test('prompts the user to include the configuration when reset is used if the flag', async () => {
    // Given
    const app = testAppWithConfig({config: {client_id: APP2.apiKey, build: {include_config_on_deploy: true}}})
    const identifiers = {
      app: APP2.apiKey,
      extensions: {},
      extensionIds: {},
      extensionsNonUuidManaged: {},
    }
    vi.mocked(ensureDeploymentIdsPresence).mockResolvedValue(identifiers)
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)
    vi.mocked(getAppConfigurationFileName).mockReturnValue('shopify.app.toml')
    const patchAppConfigurationFileSpy = vi
      .spyOn(patchAppConfigurationFile, 'patchAppConfigurationFile')
      .mockResolvedValue()
    const metadataSpyOn = vi.spyOn(metadata, 'addPublicMetadata').mockImplementation(async () => {})

    const options = deployOptions(app, true)
    vi.mocked(selectDeveloperPlatformClient).mockReturnValue(options.developerPlatformClient)
    // When
    await ensureDeployContext(deployOptions(app, true))

    // Then
    expect(metadataSpyOn).toHaveBeenNthCalledWith(1, expect.any(Function))
    expect(metadataSpyOn.mock.calls[0]![0]()).toEqual({cmd_deploy_confirm_include_config_used: false})

    expect(renderConfirmationPrompt).toHaveBeenCalled()
    expect(patchAppConfigurationFileSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        path: app.configuration.path,
        patch: {
          build: {include_config_on_deploy: false},
        },
        schema: expect.any(Object),
      }),
    )

    expect(renderInfo).toHaveBeenCalledWith({
      body: [
        {
          list: {
            items: ['Org:             org1', 'App:             app2'],
          },
        },
        '\n',
        'You can pass ',
        {
          command: '--reset',
        },
        ' to your command to reset your app configuration.',
      ],
      headline: 'Using shopify.app.toml for default values:',
    })
    patchAppConfigurationFileSpy.mockRestore()
  })

  test('doesnt prompt the user to include the configuration when force is used if the flag is not present', async () => {
    // Given
    const app = testAppWithConfig({config: {client_id: APP2.apiKey}})
    const identifiers = {
      app: APP2.apiKey,
      extensions: {},
      extensionIds: {},
      extensionsNonUuidManaged: {},
    }
    vi.mocked(ensureDeploymentIdsPresence).mockResolvedValue(identifiers)
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)
    vi.mocked(getAppConfigurationFileName).mockReturnValue('shopify.app.toml')
    const patchAppConfigurationFileSpy = vi
      .spyOn(patchAppConfigurationFile, 'patchAppConfigurationFile')
      .mockResolvedValue()

    const options = deployOptions(app, false, true)
    vi.mocked(selectDeveloperPlatformClient).mockReturnValue(options.developerPlatformClient)

    // When
    await ensureDeployContext(options)

    // Then
    expect(renderConfirmationPrompt).not.toHaveBeenCalled()
    expect(patchAppConfigurationFileSpy).not.toHaveBeenCalled()
    expect(renderInfo).toHaveBeenCalledWith({
      body: [
        {
          list: {
            items: ['Org:             org1', 'App:             app2', 'Include config:  No'],
          },
        },
        '\n',
        'You can pass ',
        {
          command: '--reset',
        },
        ' to your command to reset your app configuration.',
      ],
      headline: 'Using shopify.app.toml for default values:',
    })
    patchAppConfigurationFileSpy.mockRestore()
  })

  test('prompt the user to include the configuration when force is used  if the flag', async () => {
    // Given
    const app = testAppWithConfig({config: {client_id: APP2.apiKey, build: {include_config_on_deploy: true}}})
    const identifiers = {
      app: APP2.apiKey,
      extensions: {},
      extensionIds: {},
      extensionsNonUuidManaged: {},
    }
    vi.mocked(ensureDeploymentIdsPresence).mockResolvedValue(identifiers)
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)
    vi.mocked(getAppConfigurationFileName).mockReturnValue('shopify.app.toml')
    const patchAppConfigurationFileSpy = vi
      .spyOn(patchAppConfigurationFile, 'patchAppConfigurationFile')
      .mockResolvedValue()

    // When
    await ensureDeployContext(deployOptions(app, false, true))

    // Then
    expect(renderConfirmationPrompt).not.toHaveBeenCalled()
    expect(patchAppConfigurationFileSpy).not.toHaveBeenCalled()
    expect(renderInfo).toHaveBeenCalledWith({
      body: [
        {
          list: {
            items: ['Org:             org1', 'App:             app2', 'Include config:  Yes'],
          },
        },
        '\n',
        'You can pass ',
        {
          command: '--reset',
        },
        ' to your command to reset your app configuration.',
      ],
      headline: 'Using shopify.app.toml for default values:',
    })
    patchAppConfigurationFileSpy.mockRestore()
  })
})

describe('ensureThemeExtensionDevContext', () => {
  test('fetches theme extension when it exists', async () => {
    // Given
    const apiKey = 'apiKey'
    const extension = await testThemeExtensions()

    const mockedExtensionRegistrations = {
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
    }

    const developerPlatformClient: DeveloperPlatformClient = testDeveloperPlatformClient({
      appExtensionRegistrations: (_app: MinimalAppIdentifiers) => Promise.resolve(mockedExtensionRegistrations),
    })

    // When
    const got = await ensureThemeExtensionDevContext(extension, apiKey, developerPlatformClient)

    // Then
    expect('existing ID').toEqual(got.id)
    expect('UUID').toEqual(got.uuid)
    expect('theme app extension').toEqual(got.title)
    expect('THEME_APP_EXTENSION').toEqual(got.type)
  })

  test('creates theme extension when it does not exist', async () => {
    // Given
    const apiKey = 'apiKey'
    const extension = await testThemeExtensions()

    vi.mocked(createExtension).mockResolvedValue({
      id: 'new ID',
      uuid: 'UUID',
      title: 'theme app extension',
      type: 'THEME_APP_EXTENSION',
    })

    // When
    const got = await ensureThemeExtensionDevContext(extension, apiKey, buildDeveloperPlatformClient())

    // Then
    expect('new ID').toEqual(got.id)
    expect('UUID').toEqual(got.uuid)
    expect('theme app extension').toEqual(got.title)
    expect('THEME_APP_EXTENSION').toEqual(got.type)
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
