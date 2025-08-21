import {ensureDeployContext} from './context.js'
import {deploy, importExtensionsIfNeeded} from './deploy.js'
import {uploadExtensionsBundle} from './deploy/upload.js'
import {bundleAndBuildExtensions} from './deploy/bundle.js'
import {importAllExtensions, allExtensionTypes, filterOutImportedExtensions} from './import-extensions.js'
import {getExtensions} from './fetch-extensions.js'
import {reloadApp} from '../models/app/loader.js'
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
import {getTomls} from '../utilities/app/config/getTomls.js'
import {beforeEach, describe, expect, vi, test} from 'vitest'
import {
  renderInfo,
  renderSuccess,
  renderTasks,
  renderTextPrompt,
  Task,
  renderConfirmationPrompt,
  isTTY,
} from '@shopify/cli-kit/node/ui'
import {formatPackageManagerCommand} from '@shopify/cli-kit/node/output'
import {randomUUID} from '@shopify/cli-kit/node/crypto'
import {AbortSilentError} from '@shopify/cli-kit/node/error'

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
vi.mock('./import-extensions.js')
vi.mock('./fetch-extensions.js')
vi.mock('../models/app/loader.js')
vi.mock('../utilities/app/config/getTomls.js')

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

  // Mock getExtensions to return empty arrays by default
  vi.mocked(getExtensions).mockResolvedValue([])

  // Mock filterOutImportedExtensions to return the extensions by default
  vi.mocked(filterOutImportedExtensions).mockImplementation((_app, extensions) => extensions)
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
      appManifest: {
        name: 'App',
        handle: '',
        modules: [],
      },
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
    const appManifest = await app.manifest(undefined)

    // When
    await testDeployBundle({
      app,
      remoteApp,
      developerPlatformClient,
    })

    // Then
    expect(uploadExtensionsBundle).toHaveBeenCalledWith({
      appManifest,
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
      appManifest: {
        name: 'App',
        handle: '',
        modules: [
          {
            type: 'web_pixel_extension_external',
            handle: 'test-ui-extension',
            uid: 'test-ui-extension-uid',
            uuid: 'test-ui-extension',
            assets: 'test-ui-extension-uid',
            target: '',
            config: expect.any(Object),
          },
        ],
      },
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
      appManifest: {
        name: 'App',
        handle: '',
        modules: [
          {
            type: 'theme_external',
            handle: 'theme-extension-name',
            uid: undefined,
            uuid: 'theme-extension-name',
            assets: undefined,
            target: '',
            config: expect.any(Object),
          },
        ],
      },
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
      appManifest: {
        name: 'App',
        handle: '',
        modules: [
          {
            type: 'function_external',
            handle: 'test-function-extension',
            uid: undefined,
            uuid: 'test-function-extension',
            assets: undefined,
            target: '',
            config: expect.any(Object),
          },
        ],
      },
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
      appManifest: {
        name: 'App',
        handle: '',
        modules: [
          {
            type: 'web_pixel_extension_external',
            handle: 'test-ui-extension',
            uid: 'test-ui-extension-uid',
            uuid: 'test-ui-extension',
            assets: 'test-ui-extension-uid',
            target: '',
            config: expect.any(Object),
          },
          {
            type: 'theme_external',
            handle: 'theme-extension-name',
            uid: undefined,
            uuid: 'theme-extension-name',
            assets: undefined,
            target: '',
            config: expect.any(Object),
          },
        ],
      },
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
      appManifest: {
        name: 'App',
        handle: '',
        modules: [
          {
            type: 'point_of_sale_external',
            handle: 'point_of_sale',
            uid: 'point_of_sale',
            uuid: undefined,
            assets: 'point_of_sale',
            target: '',
            config: expect.any(Object),
          },
        ],
      },
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
    const localApp = {
      allExtensions: [extensionNonUuidManaged],
      configuration: {...DEFAULT_CONFIG, build: {include_config_on_deploy: false}},
    }
    const app = testAppLinked(localApp)
    const commitReference = 'https://github.com/deploytest/repo/commit/d4e5ce7999242b200acde378654d62c14b211bcc'

    // When
    await testDeployBundle({app, remoteApp, released: false, commitReference, developerPlatformClient})

    // Then
    expect(uploadExtensionsBundle).toHaveBeenCalledWith({
      appManifest: {
        name: 'App',
        handle: '',
        modules: [
          {
            type: 'point_of_sale_external',
            handle: 'point_of_sale',
            uid: 'point_of_sale',
            uuid: undefined,
            assets: 'point_of_sale',
            target: '',
            config: expect.any(Object),
          },
        ],
      },
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
      customSections: [],
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
      customSections: [],
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
      customSections: [],
      nextSteps: [
        [
          'Run',
          {command: formatPackageManagerCommand(app.packageManager, 'shopify app release', `--version=${versionTag}`)},
          'to release this version to users.',
        ],
      ],
    })
  })

  test('shows a custom section when migrating extensions to dev dash', async () => {
    // Given
    const app = testAppLinked()

    vi.mocked(getTomls).mockResolvedValue({
      '111': 'shopify.app.prod.toml',
      '222': 'shopify.app.stg.toml',
    })

    // When
    await testDeployBundle({app, remoteApp, developerPlatformClient, didMigrateExtensionsToDevDash: true})

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
      customSections: [
        {
          title: 'Next steps',
          body: [
            '• Map extension IDs to other copies of your app by running',
            {command: formatPackageManagerCommand(app.packageManager, 'shopify app deploy')},
            'for: ',
            {list: {items: ['shopify.app.prod.toml', 'shopify.app.stg.toml']}},
            "• Commit to source control to ensure your extension IDs aren't regenerated on the next deploy.",
          ],
        },
        {
          title: 'Reference',
          body: [
            '• ',
            {
              link: {
                label: 'Migrating from the Partner Dashboard',
                url: 'https://shopify.dev/docs/apps/build/dev-dashboard/migrate-from-partners',
              },
            },
          ],
        },
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
  didMigrateExtensionsToDevDash?: boolean
}

async function testDeployBundle({
  app,
  remoteApp,
  options,
  released = true,
  commitReference,
  appToDeploy,
  developerPlatformClient,
  didMigrateExtensionsToDevDash = false,
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

  vi.mocked(ensureDeployContext).mockResolvedValue({identifiers, didMigrateExtensionsToDevDash})

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
    skipBuild: false,
  })
}

describe('ImportExtensionsIfNeeded', () => {
  test('skips extension import when force flag is true', async () => {
    // Given
    const app = testAppLinked()
    const remoteApp = testOrganizationApp()
    const developerPlatformClient = testDeveloperPlatformClient()

    vi.mocked(getExtensions).mockResolvedValue([])

    // When
    const result = await importExtensionsIfNeeded({
      app,
      remoteApp,
      developerPlatformClient,
      force: true,
    })

    // Then
    expect(result).toBe(app)
    expect(getExtensions).toHaveBeenCalledWith({
      developerPlatformClient,
      apiKey: remoteApp.apiKey,
      organizationId: remoteApp.organizationId,
      extensionTypes: allExtensionTypes,
      onlyDashboardManaged: true,
    })
  })

  test('skips extension import when not in TTY environment', async () => {
    // Given
    const app = testAppLinked()
    const remoteApp = testOrganizationApp()
    const developerPlatformClient = testDeveloperPlatformClient()
    vi.mocked(isTTY).mockReturnValue(false)

    vi.mocked(getExtensions).mockResolvedValue([])

    // When
    const result = await importExtensionsIfNeeded({
      app,
      remoteApp,
      developerPlatformClient,
      force: false,
    })

    // Then
    expect(result).toBe(app)
    expect(getExtensions).toHaveBeenCalledWith({
      developerPlatformClient,
      apiKey: remoteApp.apiKey,
      organizationId: remoteApp.organizationId,
      extensionTypes: allExtensionTypes,
      onlyDashboardManaged: true,
    })
  })

  test('prompts for extension import when in TTY environment and force is false', async () => {
    // Given
    const app = testAppLinked()
    const remoteApp = testOrganizationApp()
    const developerPlatformClient = testDeveloperPlatformClient()
    const mockExtensions = [{title: 'Extension 1'}, {title: 'Extension 2'}]
    const mockExtensionRegistrations = [{id: '1'}, {id: '2'}]
    const reloadedApp = {...app, name: 'reloaded'}

    vi.mocked(isTTY).mockReturnValue(true)
    vi.mocked(getExtensions).mockResolvedValue(mockExtensions as any)
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
    vi.mocked(reloadApp).mockResolvedValue(reloadedApp as any)

    // When
    const result = await importExtensionsIfNeeded({
      app,
      remoteApp,
      developerPlatformClient,
      force: false,
    })

    // Then
    expect(getExtensions).toHaveBeenCalledWith({
      developerPlatformClient,
      apiKey: remoteApp.apiKey,
      organizationId: remoteApp.organizationId,
      extensionTypes: allExtensionTypes,
      onlyDashboardManaged: true,
    })
    expect(renderConfirmationPrompt).toHaveBeenCalledWith({
      message: [
        'App includes legacy extensions that will be deprecated soon:\n',
        '  - Extension 1\n  - Extension 2',
        '\n\nRun ',
        {command: 'shopify app import-extensions'},
        'to add legacy extensions now?',
      ],
      confirmationMessage: 'Yes, add legacy extensions and deploy',
      cancellationMessage: 'No, skip for now',
    })
    expect(importAllExtensions).toHaveBeenCalledWith({
      app,
      remoteApp,
      developerPlatformClient,
      extensions: mockExtensions,
    })
    expect(result).toBe(reloadedApp)
  })

  test('returns original app when no extensions are pending', async () => {
    // Given
    const app = testAppLinked()
    const remoteApp = testOrganizationApp()
    const developerPlatformClient = testDeveloperPlatformClient()

    vi.mocked(isTTY).mockReturnValue(true)
    vi.mocked(getExtensions).mockResolvedValue([])
    vi.mocked(filterOutImportedExtensions).mockReturnValue([])

    // When
    const result = await importExtensionsIfNeeded({
      app,
      remoteApp,
      developerPlatformClient,
      force: false,
    })

    // Then
    expect(result).toBe(app)
    expect(renderConfirmationPrompt).not.toHaveBeenCalled()
  })

  test('returns original app when user declines import', async () => {
    // Given
    const app = testAppLinked()
    const remoteApp = testOrganizationApp()
    const developerPlatformClient = testDeveloperPlatformClient()
    const mockExtensions = [{title: 'Extension 1'}]

    vi.mocked(isTTY).mockReturnValue(true)
    vi.mocked(getExtensions).mockResolvedValue(mockExtensions as any)
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)

    // When
    const result = await importExtensionsIfNeeded({
      app,
      remoteApp,
      developerPlatformClient,
      force: false,
    })

    // Then
    expect(result).toBe(app)
    expect(importAllExtensions).not.toHaveBeenCalled()
    expect(reloadApp).not.toHaveBeenCalled()
  })

  test('throws error when platform does not support dashboard managed extensions and force is true', async () => {
    // Given
    const app = testAppLinked()
    const remoteApp = testOrganizationApp()
    const developerPlatformClient = testDeveloperPlatformClient({
      supportsDashboardManagedExtensions: false,
    })
    const mockExtensions = [{title: 'Extension 1'}]

    vi.mocked(isTTY).mockReturnValue(true)
    vi.mocked(getExtensions).mockResolvedValue(mockExtensions as any)

    // When/Then
    await expect(
      importExtensionsIfNeeded({
        app,
        remoteApp,
        developerPlatformClient,
        force: true,
      }),
    ).rejects.toThrow(
      "App can't be deployed until Partner Dashboard managed extensions are added to your version or removed from your app:",
    )
  })

  test('throws error when platform does not support dashboard managed extensions and not in TTY', async () => {
    // Given
    const app = testAppLinked()
    const remoteApp = testOrganizationApp()
    const developerPlatformClient = testDeveloperPlatformClient({
      supportsDashboardManagedExtensions: false,
    })
    const mockExtensions = [{title: 'Extension 1'}]

    vi.mocked(isTTY).mockReturnValue(false)
    vi.mocked(getExtensions).mockResolvedValue(mockExtensions as any)

    // When/Then
    await expect(
      importExtensionsIfNeeded({
        app,
        remoteApp,
        developerPlatformClient,
        force: false,
      }),
    ).rejects.toThrow(
      "App can't be deployed until Partner Dashboard managed extensions are added to your version or removed from your app:",
    )
  })

  test('imports extensions when platform does not support dashboard managed extensions', async () => {
    // Given
    const app = testAppLinked()
    const remoteApp = testOrganizationApp()
    const developerPlatformClient = testDeveloperPlatformClient({
      supportsDashboardManagedExtensions: false,
    })
    const mockExtensions = [{title: 'Extension 1'}]
    const reloadedApp = {...app, name: 'reloaded'}

    vi.mocked(isTTY).mockReturnValue(true)
    vi.mocked(getExtensions).mockResolvedValue(mockExtensions as any)
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
    vi.mocked(reloadApp).mockResolvedValue(reloadedApp as any)

    // When
    const result = await importExtensionsIfNeeded({
      app,
      remoteApp,
      developerPlatformClient,
      force: false,
    })

    // Then
    expect(getExtensions).toHaveBeenCalledWith({
      developerPlatformClient,
      apiKey: remoteApp.apiKey,
      organizationId: remoteApp.organizationId,
      extensionTypes: allExtensionTypes,
      onlyDashboardManaged: true,
    })
    expect(importAllExtensions).toHaveBeenCalledWith({
      app,
      remoteApp,
      developerPlatformClient,
      extensions: mockExtensions,
    })
    expect(result).toBe(reloadedApp)
  })

  test('throws error when platform does not support dashboard managed extensions and force is true', async () => {
    // Given
    const app = testAppLinked()
    const remoteApp = testOrganizationApp()
    const developerPlatformClient = testDeveloperPlatformClient({
      supportsDashboardManagedExtensions: false,
    })
    const mockExtensions = [{title: 'Extension 1'}]

    vi.mocked(isTTY).mockReturnValue(true)
    vi.mocked(getExtensions).mockResolvedValue(mockExtensions as any)

    // When/Then
    await expect(
      importExtensionsIfNeeded({
        app,
        remoteApp,
        developerPlatformClient,
        force: true,
      }),
    ).rejects.toThrow(
      "App can't be deployed until Partner Dashboard managed extensions are added to your version or removed from your app:",
    )
  })

  test('throws error when platform does not support dashboard managed extensions and not TTY', async () => {
    // Given
    const app = testAppLinked()
    const remoteApp = testOrganizationApp()
    const developerPlatformClient = testDeveloperPlatformClient({
      supportsDashboardManagedExtensions: false,
    })
    const mockExtensions = [{title: 'Extension 1'}]

    vi.mocked(isTTY).mockReturnValue(false)
    vi.mocked(getExtensions).mockResolvedValue(mockExtensions as any)

    // When/Then
    await expect(
      importExtensionsIfNeeded({
        app,
        remoteApp,
        developerPlatformClient,
        force: false,
      }),
    ).rejects.toThrow(
      "App can't be deployed until Partner Dashboard managed extensions are added to your version or removed from your app:",
    )
  })

  test('throws silent error when platform does not support dashboard managed extensions and user cancels', async () => {
    // Given
    const app = testAppLinked()
    const remoteApp = testOrganizationApp()
    const developerPlatformClient = testDeveloperPlatformClient({
      supportsDashboardManagedExtensions: false,
    })
    const mockExtensions = [{title: 'Extension 1'}]

    vi.mocked(isTTY).mockReturnValue(true)
    vi.mocked(getExtensions).mockResolvedValue(mockExtensions as any)
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)

    // When/Then
    await expect(
      importExtensionsIfNeeded({
        app,
        remoteApp,
        developerPlatformClient,
        force: false,
      }),
    ).rejects.toThrowError(AbortSilentError)
  })

  test('returns app without prompting when platform supports dashboard managed extensions and force is true', async () => {
    // Given
    const app = testAppLinked()
    const remoteApp = testOrganizationApp()
    const developerPlatformClient = testDeveloperPlatformClient()
    const mockExtensions = [{title: 'Extension 1'}]

    vi.mocked(isTTY).mockReturnValue(true)
    vi.mocked(getExtensions).mockResolvedValue(mockExtensions as any)

    // When
    const result = await importExtensionsIfNeeded({
      app,
      remoteApp,
      developerPlatformClient,
      force: true,
    })

    // Then
    expect(renderConfirmationPrompt).not.toHaveBeenCalled()
    expect(importAllExtensions).not.toHaveBeenCalled()
    expect(result).toBe(app)
  })

  test('returns app without prompting when platform supports dashboard managed extensions and not TTY', async () => {
    // Given
    const app = testAppLinked()
    const remoteApp = testOrganizationApp()
    const developerPlatformClient = testDeveloperPlatformClient()
    const mockExtensions = [{title: 'Extension 1'}]

    vi.mocked(isTTY).mockReturnValue(false)
    vi.mocked(getExtensions).mockResolvedValue(mockExtensions as any)

    // When
    const result = await importExtensionsIfNeeded({
      app,
      remoteApp,
      developerPlatformClient,
      force: false,
    })

    // Then
    expect(renderConfirmationPrompt).not.toHaveBeenCalled()
    expect(importAllExtensions).not.toHaveBeenCalled()
    expect(result).toBe(app)
  })

  test('ensureDeploymentIdsPresence throws when forcing deploy and unassigned dashboard extensions exist on unsupported platform', async () => {
    // Given
    const app = testAppLinked()
    const remoteApp = testOrganizationApp()
    const developerPlatformClient = testDeveloperPlatformClient({
      supportsDashboardManagedExtensions: false,
      appExtensionRegistrations: async () =>
        Promise.resolve({
          app: {
            extensionRegistrations: [{id: '', title: 'Legacy extension'}],
            configurationRegistrations: [],
          },
        } as any),
    })

    const identifiersModule = await vi.importActual<typeof import('./context/identifiers.js')>(
      './context/identifiers.js',
    )

    // When/Then
    await expect(
      identifiersModule.ensureDeploymentIdsPresence({
        app,
        developerPlatformClient,
        appId: remoteApp.apiKey,
        appName: remoteApp.title,
        envIdentifiers: {},
        force: true,
        release: true,
        remoteApp,
      } as any),
    ).rejects.toThrow('need to be assigned')
  })
})
