import {ensureDeployContext} from './context.js'
import {deploy} from './deploy.js'
import {uploadExtensionsBundle} from './deploy/upload.js'
import {bundleAndBuildExtensions} from './deploy/bundle.js'
import {
  testFunctionExtension,
  testThemeExtensions,
  testUIExtension,
  testOrganizationApp,
  testAppConfigExtensions,
  DEFAULT_CONFIG,
  testDeveloperPlatformClient,
  testAppLinked,
  testOrganization,
} from '../models/app/app.test-data.js'
import {updateAppIdentifiers} from '../models/app/identifiers.js'
import {AppInterface, AppLinkedInterface} from '../models/app/app.js'
import {OrganizationApp} from '../models/organization.js'
import {DeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {PosSpecIdentifier} from '../models/extensions/specifications/app_config_point_of_sale.js'
import {beforeEach, describe, expect, vi, test} from 'vitest'
import {renderInfo, renderSuccess, renderTasks, renderTextPrompt, Task} from '@shopify/cli-kit/node/ui'
import {formatPackageManagerCommand} from '@shopify/cli-kit/node/output'
import {randomUUID} from '@shopify/cli-kit/node/crypto'

const versionTag = 'unique-version-tag'
const developerPlatformClient: DeveloperPlatformClient = testDeveloperPlatformClient()
const remoteApp = testOrganizationApp({
  id: 'app-id',
  organizationId: 'org-id',
})

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
vi.mock('@shopify/cli-kit/node/crypto')
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
    const app = testAppLinked({allExtensions: []})
    vi.mocked(renderTextPrompt).mockResolvedValue('Deployed from CLI')

    // When
    await testDeployBundle({
      app,
      remoteApp,
      options: {
        noRelease: false,
      },
      developerPlatformClient,
    })

    // Then
    expect(uploadExtensionsBundle).toHaveBeenCalledWith({
      appId: 'app-id',
      apiKey: 'api-key',
      name: app.name,
      organizationId: 'org-id',
      appModules: [],
      developerPlatformClient,
      extensionIds: {},
      release: true,
    })
  })

  test('passes a message to uploadExtensionsBundle() when a message arg is present', async () => {
    // Given
    const app = testAppLinked()

    // When
    await testDeployBundle({
      app,
      remoteApp,
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
    const app = testAppLinked()

    // When
    await testDeployBundle({
      app,
      remoteApp,
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
    const app = testAppLinked({allExtensions: []})
    vi.mocked(renderTextPrompt).mockResolvedValueOnce('')

    // When
    await testDeployBundle({
      app,
      remoteApp,
      developerPlatformClient,
    })

    // Then
    expect(uploadExtensionsBundle).toHaveBeenCalledWith({
      appId: 'app-id',
      apiKey: 'api-key',
      name: app.name,
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
    const app = testAppLinked({allExtensions: [uiExtension]})

    // When
    await testDeployBundle({app, remoteApp, developerPlatformClient})

    // Then
    expect(uploadExtensionsBundle).toHaveBeenCalledWith({
      appId: 'app-id',
      apiKey: 'api-key',
      name: app.name,
      organizationId: 'org-id',
      bundlePath: expect.stringMatching(/bundle.zip$/),
      appModules: [
        {
          uuid: uiExtension.localIdentifier,
          config: '{}',
          context: '',
          handle: uiExtension.handle,
          specificationIdentifier: undefined,
          uid: uiExtension.uid,
        },
      ],
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
    const app = testAppLinked({allExtensions: [themeExtension]})

    // When
    await testDeployBundle({app, remoteApp, developerPlatformClient})

    // Then
    expect(uploadExtensionsBundle).toHaveBeenCalledWith({
      appId: 'app-id',
      apiKey: 'api-key',
      name: app.name,
      organizationId: 'org-id',
      bundlePath: expect.stringMatching(/bundle.zip$/),
      appModules: [
        {
          uuid: themeExtension.localIdentifier,
          config: '{"theme_extension":{"files":{}}}',
          context: '',
          handle: themeExtension.handle,
          specificationIdentifier: undefined,
          uid: themeExtension.uid,
        },
      ],
      developerPlatformClient,
      extensionIds: {},
      release: true,
    })
    expect(bundleAndBuildExtensions).toHaveBeenCalledOnce()
    expect(updateAppIdentifiers).toHaveBeenCalledOnce()
  })

  test('uploads the extension bundle with 1 function extension', async () => {
    // Given
    const functionExtension = await testFunctionExtension()
    const moduleId = 'module-id'
    vi.spyOn(functionExtension, 'preDeployValidation').mockImplementation(async () => {})
    vi.mocked(randomUUID).mockReturnValue(moduleId)

    const app = testAppLinked({allExtensions: [functionExtension]})
    const mockedFunctionConfiguration = {
      title: functionExtension.configuration.name,
      module_id: moduleId,
      description: functionExtension.configuration.description,
      app_key: 'api-key',
      api_type: functionExtension.configuration.type,
      api_version: functionExtension.configuration.api_version,
      enable_creation_ui: true,
      localization: {},
    }

    // When
    await testDeployBundle({
      app,
      remoteApp,
      developerPlatformClient,
    })

    // Then
    expect(uploadExtensionsBundle).toHaveBeenCalledWith({
      appId: 'app-id',
      apiKey: 'api-key',
      name: app.name,
      organizationId: 'org-id',
      appModules: [
        {
          uuid: functionExtension.localIdentifier,
          config: JSON.stringify(mockedFunctionConfiguration),
          context: '',
          handle: functionExtension.handle,
          specificationIdentifier: undefined,
          uid: functionExtension.uid,
        },
      ],
      developerPlatformClient,
      extensionIds: {},
      bundlePath: expect.stringMatching(/bundle.zip$/),
      release: true,
    })
    expect(bundleAndBuildExtensions).toHaveBeenCalledOnce()
    expect(updateAppIdentifiers).toHaveBeenCalledOnce()
  })

  test('uploads the extension bundle with 1 UI and 1 theme extension', async () => {
    // Given
    const uiExtension = await testUIExtension({type: 'web_pixel_extension'})
    const themeExtension = await testThemeExtensions()
    const app = testAppLinked({allExtensions: [uiExtension, themeExtension]})
    const commitReference = 'https://github.com/deploytest/repo/commit/d4e5ce7999242b200acde378654d62c14b211bcc'

    // When
    await testDeployBundle({app, remoteApp, released: false, commitReference, developerPlatformClient})

    // Then
    expect(uploadExtensionsBundle).toHaveBeenCalledWith({
      appId: 'app-id',
      apiKey: 'api-key',
      name: app.name,
      organizationId: 'org-id',
      bundlePath: expect.stringMatching(/bundle.zip$/),
      appModules: [
        {
          uuid: uiExtension.localIdentifier,
          config: '{}',
          context: '',
          handle: uiExtension.handle,
          specificationIdentifier: undefined,
          uid: uiExtension.uid,
        },
        {
          uuid: themeExtension.localIdentifier,
          config: '{"theme_extension":{"files":{}}}',
          context: '',
          handle: themeExtension.handle,
          specificationIdentifier: undefined,
          uid: themeExtension.uid,
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
    const app = testAppLinked(localApp)
    const commitReference = 'https://github.com/deploytest/repo/commit/d4e5ce7999242b200acde378654d62c14b211bcc'

    // When
    await testDeployBundle({app, remoteApp, released: false, commitReference, developerPlatformClient})

    // Then
    expect(uploadExtensionsBundle).toHaveBeenCalledWith({
      appId: 'app-id',
      apiKey: 'api-key',
      name: app.name,
      organizationId: 'org-id',
      appModules: [
        {
          uuid: extensionNonUuidManaged.localIdentifier,
          config: JSON.stringify({embedded: true}),
          context: '',
          handle: extensionNonUuidManaged.handle,
          specificationIdentifier: undefined,
          uid: PosSpecIdentifier,
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
    const app = testAppLinked({allExtensions: [extensionNonUuidManaged]})
    const commitReference = 'https://github.com/deploytest/repo/commit/d4e5ce7999242b200acde378654d62c14b211bcc'

    // When
    await testDeployBundle({app, remoteApp, released: false, commitReference, developerPlatformClient})

    // Then
    expect(uploadExtensionsBundle).toHaveBeenCalledWith({
      appId: 'app-id',
      apiKey: 'api-key',
      name: app.name,
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
    const app = testAppLinked({allExtensions: [uiExtension]})
    vi.mocked(renderTextPrompt).mockResolvedValue('Deployed from CLI')

    // When
    await testDeployBundle({
      app,
      remoteApp,
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
    const app = testAppLinked({allExtensions: [uiExtension]})
    vi.mocked(renderTextPrompt).mockResolvedValue('Deployed from CLI')

    // When
    await testDeployBundle({
      app,
      remoteApp,
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
    const app = testAppLinked({allExtensions: [uiExtension]})
    vi.mocked(renderTextPrompt).mockResolvedValue('Deployed from CLI')

    // When
    await testDeployBundle({
      app,
      remoteApp,
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
  app: AppLinkedInterface
  remoteApp: OrganizationApp
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
  for (const extension of app.allExtensions.filter((ext) => ext.isUUIDStrategyExtension)) {
    extensionsPayload[extension.localIdentifier] = extension.localIdentifier
  }
  const extensionsNonUuidPayload: {[key: string]: string} = {}
  for (const extension of app.allExtensions.filter((ext) => !ext.isUUIDStrategyExtension)) {
    extensionsNonUuidPayload[extension.localIdentifier] = extension.localIdentifier
  }
  const identifiers = {
    app: 'app-id',
    extensions: extensionsPayload,
    extensionIds: {},
    extensionsNonUuidManaged: extensionsNonUuidPayload,
  }

  vi.mocked(ensureDeployContext).mockResolvedValue(identifiers)

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
    remoteApp,
    organization: testOrganization(),
    reset: false,
    force: Boolean(options?.force),
    noRelease: Boolean(options?.noRelease),
    message: options?.message,
    version: options?.version,
    ...(commitReference ? {commitReference} : {}),
    developerPlatformClient,
  })
}
