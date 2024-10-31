import {fetchOrganizations, fetchOrgFromId} from './dev/fetch.js'
import {selectOrCreateApp} from './dev/select-app.js'
import {selectStore} from './dev/select-store.js'
import {ensureDeploymentIdsPresence} from './context/identifiers.js'
import {ensureDeployContext, ensureThemeExtensionDevContext} from './context.js'
import {createExtension} from './dev/create-extension.js'
import {CachedAppInfo} from './local-storage.js'
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
import {AppConfigurationStateLinked, getAppConfigurationFileName, isWebType, loadApp} from '../models/app/loader.js'
import {AppInterface, AppLinkedInterface} from '../models/app/app.js'
import * as loadSpecifications from '../models/extensions/load-specifications.js'
import {DeveloperPlatformClient, selectDeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {RemoteAwareExtensionSpecification} from '../models/extensions/specification.js'
import {afterEach, beforeAll, beforeEach, describe, expect, test, vi} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {getPackageManager} from '@shopify/cli-kit/node/node-package-manager'
import {renderConfirmationPrompt, renderInfo, renderTasks, Task} from '@shopify/cli-kit/node/ui'

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
const STORE1: OrganizationStore = {
  shopId: '1',
  link: 'link1',
  shopDomain: 'domain1',
  shopName: 'store1',
  transferDisabled: true,
  convertableToPartnerTest: true,
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
