import {ensureDeployContext} from './context.js'
import {deploy} from './deploy.js'
import {uploadWasmBlob, uploadExtensionsBundle} from './deploy/upload.js'
import {bundleAndBuildExtensions} from './deploy/bundle.js'
import {
  testApp,
  testFunctionExtension,
  testThemeExtensions,
  testUIExtension,
  testOrganizationApp,
  testAppConfigExtensions,
  DEFAULT_CONFIG,
  testDeveloperPlatformClient,
} from '../models/app/app.test-data.js'
import {updateAppIdentifiers} from '../models/app/identifiers.js'
import {AppInterface} from '../models/app/app.js'
import {OrganizationApp} from '../models/organization.js'
import {DeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {beforeEach, describe, expect, vi, test} from 'vitest'
import {useThemebundling} from '@shopify/cli-kit/node/context/local'
import {renderInfo, renderSuccess, renderTasks, renderTextPrompt, Task} from '@shopify/cli-kit/node/ui'
import {formatPackageManagerCommand} from '@shopify/cli-kit/node/output'

const versionTag = 'unique-version-tag'
const developerPlatformClient: DeveloperPlatformClient = testDeveloperPlatformClient()

vi.mock('../utilities/app/config/webhooks.js', async () => ({
  ...((await vi.importActual('../utilities/app/config/webhooks.js')) as any),
  fakedWebhookSubscriptionsMutation: vi.fn(),
}))
vi.mock('./context.js')
vi.mock('./deploy/upload.js')
vi.mock('./deploy/bundle.js')
vi.mock('./dev/fetch.js')
vi.mock('../models/app/identifiers.js')
vi.mock('@shopify/cli-kit/node/context/local')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('../validators/extensions.js')
vi.mock('./context/prompts')

beforeEach(() => {
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

describe('deploy', () => {
  test('passes release to uploadExtensionsBundle()', async () => {
    // Given
    const app = testApp({allExtensions: []})
    vi.mocked(renderTextPrompt).mockResolvedValue('Deployed from CLI')

    // When
    await testDeployBundle({
      app,
      remoteApp: {
        id: 'app-id',
        apiKey: 'api-key',
        organizationId: 'org-id',
        title: 'app-title',
        grantedScopes: [],
        flags: [],
      },
      options: {
        noRelease: false,
      },
      developerPlatformClient,
    })

    // Then
    expect(uploadExtensionsBundle).toHaveBeenCalledWith({
      apiKey: 'app-id',
      organizationId: 'org-id',
      appModules: [],
      developerPlatformClient,
      extensionIds: {},
      release: true,
    })
  })

  test('passes a message to uploadExtensionsBundle() when a message arg is present', async () => {
    // Given
    const app = testApp()

    // When
    await testDeployBundle({
      app,
      remoteApp: {
        id: 'app-id',
        apiKey: 'api-key',
        organizationId: 'org-id',
        title: 'app-title',
        grantedScopes: [],
        flags: [],
      },
      options: {
        message: 'Deployed from CLI with flag',
      },
      developerPlatformClient,
    })

    // Then
    expect(uploadExtensionsBundle).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Deployed from CLI with flag',
      }),
    )
  })

  test('passes a version to uploadExtensionsBundle() when a version arg is present', async () => {
    // Given
    const app = testApp()

    // When
    await testDeployBundle({
      app,
      remoteApp: {
        id: 'app-id',
        apiKey: 'api-key',
        organizationId: 'org-id',
        title: 'app-title',
        grantedScopes: [],
        flags: [],
      },
      options: {
        version: '1.1.0',
      },
      developerPlatformClient,
    })

    // Then
    expect(uploadExtensionsBundle).toHaveBeenCalledWith(
      expect.objectContaining({
        version: '1.1.0',
      }),
    )
  })

  test('deploys the app with no extensions', async () => {
    const app = testApp({allExtensions: []})
    vi.mocked(renderTextPrompt).mockResolvedValueOnce('')

    // When
    await testDeployBundle({
      app,
      remoteApp: {
        id: 'app-id',
        apiKey: 'api-key',
        organizationId: 'org-id',
        title: 'app-title',
        grantedScopes: [],
        flags: [],
      },
      developerPlatformClient,
    })

    // Then
    expect(uploadExtensionsBundle).toHaveBeenCalledWith({
      apiKey: 'app-id',
      organizationId: 'org-id',
      appModules: [],
      developerPlatformClient,
      extensionIds: {},
      release: true,
    })
    expect(bundleAndBuildExtensions).toHaveBeenCalledOnce()
    expect(updateAppIdentifiers).toHaveBeenCalledOnce()
  })

  test('uploads the extension bundle with 1 UI extension', async () => {
    // Given
    const uiExtension = await testUIExtension({type: 'web_pixel_extension'})
    const app = testApp({allExtensions: [uiExtension]})

    // When
    await testDeployBundle({app, developerPlatformClient})

    // Then
    expect(uploadExtensionsBundle).toHaveBeenCalledWith({
      apiKey: 'app-id',
      organizationId: 'org-id',
      bundlePath: expect.stringMatching(/bundle.zip$/),
      appModules: [{uuid: uiExtension.localIdentifier, config: '{}', context: '', handle: uiExtension.handle}],
      developerPlatformClient,
      extensionIds: {},
      release: true,
    })
    expect(bundleAndBuildExtensions).toHaveBeenCalledOnce()
    expect(updateAppIdentifiers).toHaveBeenCalledOnce()
  })

  test('uploads the extension bundle with 1 theme extension', async () => {
    // Given
    const themeExtension = await testThemeExtensions()
    const app = testApp({allExtensions: [themeExtension]})

    // When
    await testDeployBundle({app, developerPlatformClient})

    // Then
    expect(uploadExtensionsBundle).toHaveBeenCalledWith({
      apiKey: 'app-id',
      organizationId: 'org-id',
      bundlePath: expect.stringMatching(/bundle.zip$/),
      appModules: [
        {
          uuid: themeExtension.localIdentifier,
          config: '{"theme_extension":{"files":{}}}',
          context: '',
          handle: themeExtension.handle,
        },
      ],
      developerPlatformClient,
      extensionIds: {},
      release: true,
    })
    expect(bundleAndBuildExtensions).toHaveBeenCalledOnce()
    expect(updateAppIdentifiers).toHaveBeenCalledOnce()
  })

  test('uploads the extension bundle with 1 function', async () => {
    // Given
    const functionExtension = await testFunctionExtension()
    vi.spyOn(functionExtension, 'preDeployValidation').mockImplementation(async () => {})

    const app = testApp({allExtensions: [functionExtension]})
    const moduleId = 'module-id'
    const mockedFunctionConfiguration = {
      title: functionExtension.configuration.name,
      module_id: moduleId,
      description: functionExtension.configuration.description,
      app_key: 'app-id',
      api_type: functionExtension.configuration.type,
      api_version: functionExtension.configuration.api_version,
      enable_creation_ui: true,
      localization: {},
    }
    vi.mocked(uploadWasmBlob).mockResolvedValue({url: 'url', moduleId})

    // When
    await testDeployBundle({
      app,
      remoteApp: testOrganizationApp({
        id: 'app-id',
        organizationId: 'org-id',
      }),
      developerPlatformClient,
    })

    // Then
    expect(uploadExtensionsBundle).toHaveBeenCalledWith({
      apiKey: 'app-id',
      organizationId: 'org-id',
      appModules: [
        {
          uuid: functionExtension.localIdentifier,
          config: JSON.stringify(mockedFunctionConfiguration),
          context: '',
          handle: functionExtension.handle,
        },
      ],
      developerPlatformClient,
      extensionIds: {},
      bundlePath: undefined,
      release: true,
    })
    expect(bundleAndBuildExtensions).toHaveBeenCalledOnce()
    expect(updateAppIdentifiers).toHaveBeenCalledOnce()
  })

  test('uploads the extension bundle with 1 UI and 1 theme extension', async () => {
    // Given
    const uiExtension = await testUIExtension({type: 'web_pixel_extension'})
    const themeExtension = await testThemeExtensions()
    const app = testApp({allExtensions: [uiExtension, themeExtension]})
    const commitReference = 'https://github.com/deploytest/repo/commit/d4e5ce7999242b200acde378654d62c14b211bcc'

    // When
    await testDeployBundle({app, released: false, commitReference, developerPlatformClient})

    // Then
    expect(uploadExtensionsBundle).toHaveBeenCalledWith({
      apiKey: 'app-id',
      organizationId: 'org-id',
      bundlePath: expect.stringMatching(/bundle.zip$/),
      appModules: [
        {uuid: uiExtension.localIdentifier, config: '{}', context: '', handle: uiExtension.handle},
        {
          uuid: themeExtension.localIdentifier,
          config: '{"theme_extension":{"files":{}}}',
          context: '',
          handle: themeExtension.handle,
        },
      ],
      developerPlatformClient,
      extensionIds: {},
      release: true,
      commitReference,
    })
    expect(bundleAndBuildExtensions).toHaveBeenCalledOnce()
    expect(updateAppIdentifiers).toHaveBeenCalledOnce()
  })

  test('pushes the configuration extension if include config on deploy ', async () => {
    // Given
    const extensionNonUuidManaged = await testAppConfigExtensions()
    const localApp = {
      allExtensions: [extensionNonUuidManaged],
      configuration: {...DEFAULT_CONFIG, build: {include_config_on_deploy: true}},
    }
    const app = testApp(localApp)
    const commitReference = 'https://github.com/deploytest/repo/commit/d4e5ce7999242b200acde378654d62c14b211bcc'

    // When
    await testDeployBundle({app, released: false, commitReference, developerPlatformClient})

    // Then
    expect(uploadExtensionsBundle).toHaveBeenCalledWith({
      apiKey: 'app-id',
      organizationId: 'org-id',
      appModules: [
        {
          uuid: extensionNonUuidManaged.localIdentifier,
          config: JSON.stringify({embedded: true}),
          context: '',
          handle: extensionNonUuidManaged.handle,
        },
      ],
      developerPlatformClient,
      extensionIds: {},
      release: true,
      commitReference,
    })
    expect(bundleAndBuildExtensions).toHaveBeenCalledOnce()
    expect(updateAppIdentifiers).toHaveBeenCalledOnce()
  })

  test('doesnt push the configuration extension if include config on deploy is disabled', async () => {
    // Given
    const extensionNonUuidManaged = await testAppConfigExtensions()
    const app = testApp({allExtensions: [extensionNonUuidManaged]})
    const commitReference = 'https://github.com/deploytest/repo/commit/d4e5ce7999242b200acde378654d62c14b211bcc'

    // When
    await testDeployBundle({app, released: false, commitReference, developerPlatformClient})

    // Then
    expect(uploadExtensionsBundle).toHaveBeenCalledWith({
      apiKey: 'app-id',
      organizationId: 'org-id',
      appModules: [],
      developerPlatformClient,
      extensionIds: {},
      release: true,
      commitReference,
    })
    expect(bundleAndBuildExtensions).toHaveBeenCalledOnce()
    expect(updateAppIdentifiers).toHaveBeenCalledOnce()
  })

  test('shows a success message', async () => {
    // Given
    const uiExtension = await testUIExtension({type: 'web_pixel_extension'})
    const app = testApp({allExtensions: [uiExtension]})
    vi.mocked(renderTextPrompt).mockResolvedValue('Deployed from CLI')

    // When
    await testDeployBundle({
      app,
      remoteApp: {
        id: 'app-id',
        apiKey: 'api-key',
        organizationId: 'org-id',
        title: 'app-title',
        grantedScopes: [],
        flags: [],
      },
      options: {
        noRelease: false,
      },
      released: true,
      developerPlatformClient,
    })

    // Then
    expect(renderSuccess).toHaveBeenCalledWith({
      headline: 'New version released to users.',
      body: [
        {
          link: {
            label: 'unique-version-tag',
            url: 'https://partners.shopify.com/0/apps/0/versions/1',
          },
        },
        '',
      ],
    })
  })

  test('shows a specific success message when there is an error with the release', async () => {
    // Given
    const uiExtension = await testUIExtension({type: 'web_pixel_extension'})
    const app = testApp({allExtensions: [uiExtension]})
    vi.mocked(renderTextPrompt).mockResolvedValue('Deployed from CLI')

    // When
    await testDeployBundle({
      app,
      remoteApp: {
        id: 'app-id2',
        apiKey: 'api-key',
        organizationId: 'org-id',
        title: 'app-title',
        grantedScopes: [],
        flags: [],
      },
      options: {
        noRelease: false,
        message: 'version message',
      },
      released: false,
      developerPlatformClient,
    })

    // Then
    expect(renderInfo).toHaveBeenCalledWith({
      headline: 'New version created, but not released.',
      body: [
        {
          link: {
            label: 'unique-version-tag',
            url: 'https://partners.shopify.com/0/apps/0/versions/1',
          },
        },
        '\nversion message',
        '\n\nno release error',
      ],
    })
  })

  test('shows a specific success message when deploying --no-release', async () => {
    // Given
    const uiExtension = await testUIExtension({type: 'web_pixel_extension'})
    const app = testApp({allExtensions: [uiExtension]})
    vi.mocked(renderTextPrompt).mockResolvedValue('Deployed from CLI')

    // When
    await testDeployBundle({
      app,
      remoteApp: {
        id: 'app-id',
        apiKey: 'api-key',
        organizationId: 'org-id',
        title: 'app-title',
        grantedScopes: [],
        flags: [],
      },
      options: {
        noRelease: true,
        message: 'version message',
      },
      developerPlatformClient,
    })

    // Then
    expect(renderSuccess).toHaveBeenCalledWith({
      headline: 'New version created.',
      body: [
        {
          link: {
            label: 'unique-version-tag',
            url: 'https://partners.shopify.com/0/apps/0/versions/1',
          },
        },
        '\nversion message',
      ],
      nextSteps: [
        [
          'Run',
          {command: formatPackageManagerCommand(app.packageManager, 'shopify app release', `--version=${versionTag}`)},
          'to release this version to users.',
        ],
      ],
    })
  })
})

interface TestDeployBundleInput {
  app: AppInterface
  remoteApp?: Omit<OrganizationApp, 'apiSecretKeys'>
  options?: {
    force?: boolean
    noRelease?: boolean
    message?: string
    version?: string
  }
  released?: boolean
  commitReference?: string
  appToDeploy?: AppInterface
  developerPlatformClient: DeveloperPlatformClient
}

async function testDeployBundle({
  app,
  remoteApp,
  options,
  released = true,
  commitReference,
  appToDeploy,
  developerPlatformClient,
}: TestDeployBundleInput) {
  // Given
  const extensionsPayload: {[key: string]: string} = {}
  for (const extension of app.allExtensions.filter((ext) => ext.isUuidManaged())) {
    extensionsPayload[extension.localIdentifier] = extension.localIdentifier
  }
  const extensionsNonUuidPayload: {[key: string]: string} = {}
  for (const extension of app.allExtensions.filter((ext) => !ext.isUuidManaged())) {
    extensionsNonUuidPayload[extension.localIdentifier] = extension.localIdentifier
  }
  const identifiers = {
    app: 'app-id',
    extensions: extensionsPayload,
    extensionIds: {},
    extensionsNonUuidManaged: extensionsNonUuidPayload,
  }

  vi.mocked(ensureDeployContext).mockResolvedValue({
    app: appToDeploy ?? app,
    identifiers,
    remoteApp:
      remoteApp ??
      testOrganizationApp({
        id: 'app-id',
        organizationId: 'org-id',
      }),
    release: !options?.noRelease,
  })

  vi.mocked(useThemebundling).mockReturnValue(true)
  vi.mocked(uploadExtensionsBundle).mockResolvedValue({
    validationErrors: [],
    versionTag,
    message: options?.message,
    ...(!released && {deployError: 'no release error'}),
    location: 'https://partners.shopify.com/0/apps/0/versions/1',
  })
  vi.mocked(updateAppIdentifiers).mockResolvedValue(app)

  await deploy({
    app,
    reset: false,
    force: Boolean(options?.force),
    noRelease: Boolean(options?.noRelease),
    message: options?.message,
    version: options?.version,
    ...(commitReference ? {commitReference} : {}),
    developerPlatformClient,
  })
}
