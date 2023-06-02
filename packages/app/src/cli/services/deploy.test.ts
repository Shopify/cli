import {DeploymentMode, ensureDeployContext} from './context.js'
import {deploy} from './deploy.js'
import {
  uploadWasmBlob,
  uploadExtensionsBundle,
  uploadFunctionExtensions,
  functionConfiguration,
} from './deploy/upload.js'
import {fetchAppExtensionRegistrations} from './dev/fetch.js'
import {bundleAndBuildExtensions} from './deploy/bundle.js'
import {testApp, testFunctionExtension, testThemeExtensions, testUIExtension} from '../models/app/app.test-data.js'
import {updateAppIdentifiers} from '../models/app/identifiers.js'
import {AppInterface} from '../models/app/app.js'
import {OrganizationApp} from '../models/organization.js'
import {beforeEach, describe, expect, vi, test} from 'vitest'
import {useThemebundling} from '@shopify/cli-kit/node/context/local'
import {renderSuccess, renderTasks, renderTextPrompt, Task} from '@shopify/cli-kit/node/ui'
import {formatPackageManagerCommand} from '@shopify/cli-kit/node/output'

const versionId = 2

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
  test("passes deploymentMode: 'legacy' to uploadExtensionsBundle() when the unifiedAppDeployment beta is disabled", async () => {
    // Given
    const uiExtension = await testUIExtension({type: 'web_pixel_extension'})
    const app = testApp({allExtensions: [uiExtension]})
    vi.mocked(renderTextPrompt).mockResolvedValue('Deployed from CLI')

    // When
    await testDeployBundle(app, {
      id: 'app-id',
      organizationId: 'org-id',
      title: 'app-title',
      grantedScopes: [],
      betas: {unifiedAppDeployment: false},
    })

    // Then
    expect(uploadExtensionsBundle).toHaveBeenCalledWith({
      apiKey: 'app-id',
      appModules: [{uuid: uiExtension.localIdentifier, config: '{}', context: ''}],
      bundlePath: expect.stringMatching(/bundle.zip$/),
      token: 'api-token',
      extensionIds: {},
      deploymentMode: 'legacy',
    })
  })

  test("passes deploymentMode: 'legacy' to uploadExtensionsBundle() when the unifiedAppDeployment beta is enabled and noRelease arg is false", async () => {
    // Given
    const app = testApp({allExtensions: []})
    vi.mocked(renderTextPrompt).mockResolvedValue('Deployed from CLI')

    // When
    await testDeployBundle(
      app,
      {
        id: 'app-id',
        organizationId: 'org-id',
        title: 'app-title',
        grantedScopes: [],
        betas: {unifiedAppDeployment: true},
      },
      {
        noRelease: false,
      },
    )

    // Then
    expect(uploadExtensionsBundle).toHaveBeenCalledWith({
      apiKey: 'app-id',
      appModules: [],
      token: 'api-token',
      extensionIds: {},
      deploymentMode: 'unified',
    })
  })

  test("passes deploymentMode: 'unified-skip-release' to uploadExtensionsBundle() when the unifiedAppDeployment beta is enabled and noRelease arg is true", async () => {
    // Given
    const app = testApp({allExtensions: []})
    vi.mocked(renderTextPrompt).mockResolvedValue('Deployed from CLI')

    // When
    await testDeployBundle(
      app,
      {
        id: 'app-id',
        organizationId: 'org-id',
        title: 'app-title',
        grantedScopes: [],
        betas: {unifiedAppDeployment: true},
      },
      {
        noRelease: true,
      },
    )

    // Then
    expect(uploadExtensionsBundle).toHaveBeenCalledWith({
      apiKey: 'app-id',
      appModules: [],
      token: 'api-token',
      extensionIds: {},
      deploymentMode: 'unified-skip-release',
    })
  })

  test('passes a message to uploadExtensionsBundle() when a message arg is present', async () => {
    // Given
    const app = testApp()

    // When
    await testDeployBundle(
      app,
      {
        id: 'app-id',
        organizationId: 'org-id',
        title: 'app-title',
        grantedScopes: [],
        betas: {unifiedAppDeployment: true},
      },
      {
        message: 'Deployed from CLI with flag',
      },
    )

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
    await testDeployBundle(
      app,
      {
        id: 'app-id',
        organizationId: 'org-id',
        title: 'app-title',
        grantedScopes: [],
        betas: {unifiedAppDeployment: true},
      },
      {
        version: '1.1.0',
      },
    )

    // Then
    expect(uploadExtensionsBundle).toHaveBeenCalledWith(
      expect.objectContaining({
        version: '1.1.0',
      }),
    )
  })

  test('deploys the app with no extensions and beta flag', async () => {
    const app = testApp({allExtensions: []})
    vi.mocked(renderTextPrompt).mockResolvedValueOnce('')

    // When
    await testDeployBundle(app, {
      id: 'app-id',
      organizationId: 'org-id',
      title: 'app-title',
      grantedScopes: [],
      betas: {unifiedAppDeployment: true},
    })

    // Then
    expect(uploadExtensionsBundle).toHaveBeenCalledWith({
      apiKey: 'app-id',
      appModules: [],
      token: 'api-token',
      extensionIds: {},
      deploymentMode: 'unified',
    })
    expect(bundleAndBuildExtensions).toHaveBeenCalledOnce()
    expect(updateAppIdentifiers).toHaveBeenCalledOnce()
    expect(fetchAppExtensionRegistrations).toHaveBeenCalledOnce()
  })

  test("doesn't deploy the app with no extensions and no beta flag", async () => {
    const app = testApp({allExtensions: []})

    // When
    await testDeployBundle(app, {
      id: 'app-id',
      organizationId: 'org-id',
      title: 'app-title',
      grantedScopes: [],
      betas: {unifiedAppDeployment: false},
    })

    // Then
    expect(uploadExtensionsBundle).not.toHaveBeenCalled()
    expect(bundleAndBuildExtensions).not.toHaveBeenCalledOnce()
    expect(updateAppIdentifiers).not.toHaveBeenCalledOnce()
    expect(fetchAppExtensionRegistrations).not.toHaveBeenCalledOnce()
  })

  test('uploads the extension bundle with 1 UI extension', async () => {
    // Given
    const uiExtension = await testUIExtension({type: 'web_pixel_extension'})
    const app = testApp({allExtensions: [uiExtension]})

    // When
    await testDeployBundle(app)

    // Then
    expect(uploadExtensionsBundle).toHaveBeenCalledWith({
      apiKey: 'app-id',
      bundlePath: expect.stringMatching(/bundle.zip$/),
      appModules: [{uuid: uiExtension.localIdentifier, config: '{}', context: ''}],
      token: 'api-token',
      extensionIds: {},
      deploymentMode: 'legacy',
    })
    expect(bundleAndBuildExtensions).toHaveBeenCalledOnce()
    expect(updateAppIdentifiers).toHaveBeenCalledOnce()
    expect(fetchAppExtensionRegistrations).toHaveBeenCalledOnce()
  })

  test('uploads the extension bundle with 1 theme extension', async () => {
    // Given
    const themeExtension = await testThemeExtensions()
    const app = testApp({allExtensions: [themeExtension]})

    // When
    await testDeployBundle(app)

    // Then
    expect(uploadExtensionsBundle).toHaveBeenCalledWith({
      apiKey: 'app-id',
      bundlePath: expect.stringMatching(/bundle.zip$/),
      appModules: [{uuid: themeExtension.localIdentifier, config: '{"theme_extension":{"files":{}}}', context: ''}],
      token: 'api-token',
      extensionIds: {},
      deploymentMode: 'legacy',
    })
    expect(bundleAndBuildExtensions).toHaveBeenCalledOnce()
    expect(updateAppIdentifiers).toHaveBeenCalledOnce()
    expect(fetchAppExtensionRegistrations).toHaveBeenCalledOnce()
  })

  test('does not upload the extension bundle with 1 function and no beta flag', async () => {
    // Given
    const functionExtension = await testFunctionExtension()
    const app = testApp({allExtensions: [functionExtension]})

    // When
    await testDeployBundle(app)

    // Then
    expect(uploadFunctionExtensions).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          configuration: functionExtension.configuration,
          configurationPath: functionExtension.configurationPath,
          directory: functionExtension.directory,
          entrySourceFilePath: functionExtension.entrySourceFilePath,
          idEnvironmentVariableName: functionExtension.idEnvironmentVariableName,
          localIdentifier: functionExtension.localIdentifier,
          useExtensionsFramework: false,
        }),
      ],
      {
        identifiers: {app: 'app-id', extensions: {'my-function': 'my-function'}, extensionIds: {}},
        token: 'api-token',
      },
    )
    expect(bundleAndBuildExtensions).toHaveBeenCalledOnce()
    expect(updateAppIdentifiers).toHaveBeenCalledOnce()
    expect(uploadExtensionsBundle).not.toHaveBeenCalled()
    expect(fetchAppExtensionRegistrations).toHaveBeenCalledOnce()
  })

  test('uploads the extension bundle with 1 function and beta flag', async () => {
    // Given
    const functionExtension = await testFunctionExtension()
    const app = testApp({allExtensions: [functionExtension]})
    const moduleId = 'module-id'
    const mockedFunctionConfiguration = {
      title: functionExtension.configuration.name,
      description: functionExtension.configuration.description,
      api_type: functionExtension.configuration.type,
      api_version: functionExtension.configuration.apiVersion,
      enable_creation_ui: true,
      module_id: moduleId,
    }
    vi.mocked(uploadWasmBlob).mockResolvedValue({url: 'url', moduleId})
    vi.mocked(functionConfiguration).mockResolvedValue(mockedFunctionConfiguration)

    // When
    await testDeployBundle(app, {
      id: 'app-id',
      organizationId: 'org-id',
      title: 'app-title',
      grantedScopes: [],
      betas: {unifiedAppDeployment: true},
    })

    // Then
    expect(uploadExtensionsBundle).toHaveBeenCalledWith({
      apiKey: 'app-id',
      appModules: [
        {
          uuid: functionExtension.localIdentifier,
          config: JSON.stringify(mockedFunctionConfiguration),
          context: '',
        },
      ],
      token: 'api-token',
      extensionIds: {},
      bundlePath: undefined,
      deploymentMode: 'unified',
    })
    expect(bundleAndBuildExtensions).toHaveBeenCalledOnce()
    expect(updateAppIdentifiers).toHaveBeenCalledOnce()
    expect(fetchAppExtensionRegistrations).toHaveBeenCalledOnce()
  })

  test('uploads the extension bundle with 1 UI and 1 theme extension', async () => {
    // Given
    const uiExtension = await testUIExtension({type: 'web_pixel_extension'})
    const themeExtension = await testThemeExtensions()
    const app = testApp({allExtensions: [uiExtension, themeExtension]})

    // When
    await testDeployBundle(app)

    // Then
    expect(uploadExtensionsBundle).toHaveBeenCalledWith({
      apiKey: 'app-id',
      bundlePath: expect.stringMatching(/bundle.zip$/),
      appModules: [
        {uuid: uiExtension.localIdentifier, config: '{}', context: ''},
        {uuid: themeExtension.localIdentifier, config: '{"theme_extension":{"files":{}}}', context: ''},
      ],
      token: 'api-token',
      extensionIds: {},
      deploymentMode: 'legacy',
    })
    expect(bundleAndBuildExtensions).toHaveBeenCalledOnce()
    expect(updateAppIdentifiers).toHaveBeenCalledOnce()
    expect(fetchAppExtensionRegistrations).toHaveBeenCalledOnce()
  })

  test('shows a success message', async () => {
    // Given
    const uiExtension = await testUIExtension({type: 'web_pixel_extension'})
    const app = testApp({allExtensions: [uiExtension]})

    // When
    await testDeployBundle(app)

    // Then
    expect(renderSuccess).toHaveBeenCalledWith({
      headline: 'Deployed to Shopify!',
      customSections: [
        {
          body: {
            list: {
              items: [['test-ui-extension is deployed to Shopify but not yet live']],
            },
          },
          title: 'Summary',
        },
        {
          body: {
            list: {
              items: [
                [
                  'Publish',
                  {
                    link: {
                      url: 'https://partners.shopify.com/org-id/apps/app-id/extensions/web_pixel/',
                      label: 'test-ui-extension',
                    },
                  },
                ],
              ],
            },
          },
          title: 'Next steps',
        },
      ],
    })
  })

  test('shows a specific success message when deploying using the unified app deployment flow', async () => {
    // Given
    const uiExtension = await testUIExtension({type: 'web_pixel_extension'})
    const app = testApp({allExtensions: [uiExtension]})
    vi.mocked(renderTextPrompt).mockResolvedValue('Deployed from CLI')

    // When
    await testDeployBundle(
      app,
      {
        id: 'app-id',
        organizationId: 'org-id',
        title: 'app-title',
        grantedScopes: [],
        betas: {unifiedAppDeployment: true},
      },
      {
        noRelease: false,
      },
    )

    // Then
    expect(renderSuccess).toHaveBeenCalledWith({
      headline: 'New version released to users.',
      body: 'See the rollout progress of your app version in the CLI or Partner Dashboard.',
      nextSteps: [
        [
          'Run',
          {command: formatPackageManagerCommand(app.packageManager, 'versions list')},
          'to see rollout progress.',
        ],
      ],
    })
  })

  test('shows a specific success message when deploying --no-release using the unified app deployment flow', async () => {
    // Given
    const uiExtension = await testUIExtension({type: 'web_pixel_extension'})
    const app = testApp({allExtensions: [uiExtension]})
    vi.mocked(renderTextPrompt).mockResolvedValue('Deployed from CLI')

    // When
    await testDeployBundle(
      app,
      {
        id: 'app-id',
        organizationId: 'org-id',
        title: 'app-title',
        grantedScopes: [],
        betas: {unifiedAppDeployment: true},
      },
      {
        noRelease: true,
      },
    )

    // Then
    expect(renderSuccess).toHaveBeenCalledWith({
      headline: 'New version created.',
      body: 'See the rollout progress of your app version in the CLI or Partner Dashboard.',
      nextSteps: [
        [
          'Run',
          {command: formatPackageManagerCommand(app.packageManager, 'release', `--version=${versionId}`)},
          'to release this version to users.',
        ],
      ],
    })
  })
})

async function testDeployBundle(
  app: AppInterface,
  partnersApp?: Omit<OrganizationApp, 'apiSecretKeys' | 'apiKey'>,
  options?: {
    force?: boolean
    noRelease?: boolean
    message?: string
    version?: string
  },
) {
  // Given
  const extensionsPayload: {[key: string]: string} = {}
  for (const uiExtension of app.extensions.ui) {
    extensionsPayload[uiExtension.localIdentifier] = uiExtension.localIdentifier
  }
  for (const themeExtension of app.extensions.theme) {
    extensionsPayload[themeExtension.localIdentifier] = themeExtension.localIdentifier
  }
  for (const functionExtension of app.extensions.function) {
    extensionsPayload[functionExtension.localIdentifier] = functionExtension.localIdentifier
  }
  const identifiers = {app: 'app-id', extensions: extensionsPayload, extensionIds: {}}
  const deploymentMode: DeploymentMode = (function () {
    if (partnersApp?.betas?.unifiedAppDeployment) {
      if (options?.noRelease) {
        return 'unified-skip-release'
      } else {
        return 'unified'
      }
    } else {
      return 'legacy'
    }
  })()

  vi.mocked(ensureDeployContext).mockResolvedValue({
    app,
    identifiers,
    partnersApp: partnersApp ?? {
      id: 'app-id',
      organizationId: 'org-id',
      title: 'app-title',
      grantedScopes: [],
    },
    token: 'api-token',
    deploymentMode,
  })
  vi.mocked(useThemebundling).mockReturnValue(true)
  vi.mocked(uploadFunctionExtensions).mockResolvedValue(identifiers)
  vi.mocked(uploadExtensionsBundle).mockResolvedValue({validationErrors: [], deploymentId: versionId})
  vi.mocked(updateAppIdentifiers).mockResolvedValue(app)
  vi.mocked(fetchAppExtensionRegistrations).mockResolvedValue({
    app: {extensionRegistrations: [], dashboardManagedExtensionRegistrations: [], functions: []},
  })

  await deploy({
    app,
    reset: false,
    force: Boolean(options?.force),
    noRelease: Boolean(options?.noRelease),
    message: options?.message,
    version: options?.version,
  })
}
