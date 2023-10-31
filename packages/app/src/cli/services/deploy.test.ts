import {ensureDeployContext} from './context.js'
import {deploy} from './deploy.js'
import {uploadWasmBlob, uploadExtensionsBundle, uploadFunctionExtensions} from './deploy/upload.js'
import {fetchAppExtensionRegistrations} from './dev/fetch.js'
import {bundleAndBuildExtensions} from './deploy/bundle.js'
import {DeploymentMode} from './deploy/mode.js'
import {
  testApp,
  testFunctionExtension,
  testThemeExtensions,
  testUIExtension,
  testOrganizationApp,
} from '../models/app/app.test-data.js'
import {updateAppIdentifiers} from '../models/app/identifiers.js'
import {AppInterface} from '../models/app/app.js'
import {OrganizationApp} from '../models/organization.js'
import {beforeEach, describe, expect, vi, test} from 'vitest'
import {useThemebundling} from '@shopify/cli-kit/node/context/local'
import {renderInfo, renderSuccess, renderTasks, renderTextPrompt, Task} from '@shopify/cli-kit/node/ui'
import {formatPackageManagerCommand} from '@shopify/cli-kit/node/output'
import {Config} from '@oclif/core'

const versionTag = 'unique-version-tag'

vi.mock('./context.js')
vi.mock('./deploy/upload.js')
vi.mock('./deploy/bundle.js')
vi.mock('./dev/fetch.js')
vi.mock('../models/app/identifiers.js')
vi.mock('@shopify/cli-kit/node/context/local')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('../validators/extensions.js')
vi.mock('./context/prompts')

const PARTNERS_APP_WITH_UNIFIED_APP_DEPLOYMENTS_BETA = testOrganizationApp({
  id: 'app-id',
  organizationId: 'org-id',
  betas: {unifiedAppDeployment: true},
})

const PARTNERS_APP_WITHOUT_UNIFIED_APP_DEPLOYMENTS_BETA = testOrganizationApp({
  id: 'app-id',
  organizationId: 'org-id',
})

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
    await testDeployBundle({app, partnersApp: PARTNERS_APP_WITHOUT_UNIFIED_APP_DEPLOYMENTS_BETA})

    // Then
    expect(uploadExtensionsBundle).toHaveBeenCalledWith({
      apiKey: 'app-id',
      appModules: [{uuid: uiExtension.localIdentifier, config: '{}', context: '', handle: uiExtension.handle}],
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
    await testDeployBundle({
      app,
      partnersApp: {
        id: 'app-id',
        organizationId: 'org-id',
        applicationUrl: 'https://my-app.com',
        redirectUrlWhitelist: ['https://my-app.com/auth'],
        title: 'app-title',
        grantedScopes: [],
        betas: {unifiedAppDeployment: true},
      },
      options: {
        noRelease: false,
      },
    })

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
    await testDeployBundle({
      app,
      partnersApp: {
        id: 'app-id',
        organizationId: 'org-id',
        applicationUrl: 'https://my-app.com',
        redirectUrlWhitelist: ['https://my-app.com/auth'],
        title: 'app-title',
        grantedScopes: [],
        betas: {unifiedAppDeployment: true},
      },
      options: {
        noRelease: true,
      },
    })

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
    await testDeployBundle({
      app,
      partnersApp: {
        id: 'app-id',
        organizationId: 'org-id',
        applicationUrl: 'https://my-app.com',
        redirectUrlWhitelist: ['https://my-app.com/auth'],
        title: 'app-title',
        grantedScopes: [],
        betas: {unifiedAppDeployment: true},
      },
      options: {
        message: 'Deployed from CLI with flag',
      },
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
      partnersApp: {
        id: 'app-id',
        organizationId: 'org-id',
        applicationUrl: 'https://my-app.com',
        redirectUrlWhitelist: ['https://my-app.com/auth'],
        title: 'app-title',
        grantedScopes: [],
        betas: {unifiedAppDeployment: true},
      },
      options: {
        version: '1.1.0',
      },
    })

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
    await testDeployBundle({
      app,
      partnersApp: {
        id: 'app-id',
        organizationId: 'org-id',
        applicationUrl: 'https://my-app.com',
        redirectUrlWhitelist: ['https://my-app.com/auth'],
        title: 'app-title',
        grantedScopes: [],
        betas: {unifiedAppDeployment: true},
      },
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
    await testDeployBundle({app, partnersApp: PARTNERS_APP_WITHOUT_UNIFIED_APP_DEPLOYMENTS_BETA})

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
    await testDeployBundle({app})

    // Then
    expect(uploadExtensionsBundle).toHaveBeenCalledWith({
      apiKey: 'app-id',
      bundlePath: expect.stringMatching(/bundle.zip$/),
      appModules: [{uuid: uiExtension.localIdentifier, config: '{}', context: '', handle: uiExtension.handle}],
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
    await testDeployBundle({app})

    // Then
    expect(uploadExtensionsBundle).toHaveBeenCalledWith({
      apiKey: 'app-id',
      bundlePath: expect.stringMatching(/bundle.zip$/),
      appModules: [
        {
          uuid: themeExtension.localIdentifier,
          config: '{"theme_extension":{"files":{}}}',
          context: '',
          handle: themeExtension.handle,
        },
      ],
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
    vi.spyOn(functionExtension, 'preDeployValidation').mockImplementation(async () => {})
    const app = testApp({allExtensions: [functionExtension]})

    // When
    await testDeployBundle({app})

    // Then
    expect(uploadFunctionExtensions).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          configuration: functionExtension.configuration,
          directory: functionExtension.directory,
          entrySourceFilePath: functionExtension.entrySourceFilePath,
          idEnvironmentVariableName: functionExtension.idEnvironmentVariableName,
          localIdentifier: functionExtension.localIdentifier,
          useExtensionsFramework: false,
        }),
      ],
      {
        identifiers: {
          app: 'app-id',
          extensions: {'test-function-extension': 'test-function-extension'},
          extensionIds: {},
        },
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
    await testDeployBundle({app, partnersApp: PARTNERS_APP_WITH_UNIFIED_APP_DEPLOYMENTS_BETA})

    // Then
    expect(uploadExtensionsBundle).toHaveBeenCalledWith({
      apiKey: 'app-id',
      appModules: [
        {
          uuid: functionExtension.localIdentifier,
          config: JSON.stringify(mockedFunctionConfiguration),
          context: '',
          handle: functionExtension.handle,
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

  test('uploads the extension bundle with 1 function and no beta flag but switch to unified', async () => {
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
    await testDeployBundle({app, released: false, switchToDeploymentMode: 'unified'})

    // Then
    expect(uploadExtensionsBundle).toHaveBeenCalledWith({
      apiKey: 'app-id',
      appModules: [
        {
          uuid: functionExtension.localIdentifier,
          config: JSON.stringify(mockedFunctionConfiguration),
          context: '',
          handle: functionExtension.handle,
        },
      ],
      token: 'api-token',
      extensionIds: {},
      bundlePath: undefined,
      deploymentMode: 'unified',
      message: undefined,
      version: undefined,
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
    const commitReference = 'https://github.com/deploytest/repo/commit/d4e5ce7999242b200acde378654d62c14b211bcc'

    // When
    await testDeployBundle({app, released: false, commitReference, switchToDeploymentMode: 'legacy'})

    // Then
    expect(uploadExtensionsBundle).toHaveBeenCalledWith({
      apiKey: 'app-id',
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
      token: 'api-token',
      extensionIds: {},
      deploymentMode: 'legacy',
      commitReference,
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
    await testDeployBundle({app})

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

  test('shows a specific success message when deploying using the unified app deployment flow without message', async () => {
    // Given
    const uiExtension = await testUIExtension({type: 'web_pixel_extension'})
    const app = testApp({allExtensions: [uiExtension]})
    vi.mocked(renderTextPrompt).mockResolvedValue('Deployed from CLI')

    // When
    await testDeployBundle({
      app,
      partnersApp: {
        id: 'app-id',
        organizationId: 'org-id',
        applicationUrl: 'https://my-app.com',
        redirectUrlWhitelist: ['https://my-app.com/auth'],
        title: 'app-title',
        grantedScopes: [],
        betas: {unifiedAppDeployment: true},
      },
      options: {
        noRelease: false,
      },
      released: true,
      switchToDeploymentMode: 'unified',
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

  test('shows a specific success message when deploying using the unified app deployment flow but there is an error with the release', async () => {
    // Given
    const uiExtension = await testUIExtension({type: 'web_pixel_extension'})
    const app = testApp({allExtensions: [uiExtension]})
    vi.mocked(renderTextPrompt).mockResolvedValue('Deployed from CLI')

    // When
    await testDeployBundle({
      app,
      partnersApp: {
        id: 'app-id2',
        organizationId: 'org-id',
        applicationUrl: 'https://my-app.com',
        redirectUrlWhitelist: ['https://my-app.com/auth'],
        title: 'app-title',
        grantedScopes: [],
        betas: {unifiedAppDeployment: true},
      },
      options: {
        noRelease: false,
        message: 'version message',
      },
      released: false,
      switchToDeploymentMode: 'unified',
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

  test('shows a specific success message when deploying --no-release using the unified app deployment flow', async () => {
    // Given
    const uiExtension = await testUIExtension({type: 'web_pixel_extension'})
    const app = testApp({allExtensions: [uiExtension]})
    vi.mocked(renderTextPrompt).mockResolvedValue('Deployed from CLI')

    // When
    await testDeployBundle({
      app,
      partnersApp: {
        id: 'app-id',
        organizationId: 'org-id',
        applicationUrl: 'https://my-app.com',
        redirectUrlWhitelist: ['https://my-app.com/auth'],
        title: 'app-title',
        grantedScopes: [],
        betas: {unifiedAppDeployment: true},
      },
      options: {
        noRelease: true,
        message: 'version message',
      },
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
  partnersApp?: Omit<OrganizationApp, 'apiSecretKeys' | 'apiKey'>
  options?: {
    force?: boolean
    noRelease?: boolean
    message?: string
    version?: string
  }
  released?: boolean
  commitReference?: string
  switchToDeploymentMode?: DeploymentMode
}

async function testDeployBundle({
  app,
  partnersApp,
  options,
  released = true,
  commitReference,
  switchToDeploymentMode,
}: TestDeployBundleInput) {
  // Given
  const extensionsPayload: {[key: string]: string} = {}
  for (const extension of app.allExtensions) {
    extensionsPayload[extension.localIdentifier] = extension.localIdentifier
  }
  const identifiers = {app: 'app-id', extensions: extensionsPayload, extensionIds: {}}
  const deploymentMode: DeploymentMode =
    switchToDeploymentMode ??
    (function () {
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
    partnersApp:
      partnersApp ??
      testOrganizationApp({
        id: 'app-id',
        organizationId: 'org-id',
      }),
    token: 'api-token',
    deploymentMode,
  })

  vi.mocked(useThemebundling).mockReturnValue(true)
  vi.mocked(uploadFunctionExtensions).mockResolvedValue(identifiers)
  vi.mocked(uploadExtensionsBundle).mockResolvedValue({
    validationErrors: [],
    versionTag,
    message: options?.message,
    ...(!released && {deployError: 'no release error'}),
    location: 'https://partners.shopify.com/0/apps/0/versions/1',
  })
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
    ...(commitReference ? {commitReference} : {}),
    commandConfig: {runHook: vi.fn(() => Promise.resolve({successes: []}))} as unknown as Config,
  })
}
