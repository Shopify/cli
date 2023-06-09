import {ensureDeployContext} from './context.js'
import {deploy} from './deploy.js'
import {uploadWasmBlob, uploadExtensionsBundle, uploadFunctionExtensions} from './deploy/upload.js'
import {fetchAppExtensionRegistrations} from './dev/fetch.js'
import {bundleAndBuildExtensions} from './deploy/bundle.js'
import {testApp, testFunctionExtension, testThemeExtensions, testUIExtension} from '../models/app/app.test-data.js'
import {updateAppIdentifiers} from '../models/app/identifiers.js'
import {AppInterface} from '../models/app/app.js'
import {OrganizationApp} from '../models/organization.js'
import {beforeEach, describe, expect, vi, test} from 'vitest'
import {useThemebundling} from '@shopify/cli-kit/node/context/local'
import {renderSuccess, renderTasks, renderTextPrompt, Task} from '@shopify/cli-kit/node/ui'

vi.mock('./context.js')
vi.mock('./deploy/upload.js')
vi.mock('./deploy/bundle.js')
vi.mock('./dev/fetch.js')
vi.mock('../models/app/identifiers.js')
vi.mock('@shopify/cli-kit/node/context/local')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('../validators/extensions.js')

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
      extensions: [],
      token: 'api-token',
      extensionIds: {},
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
      extensions: [{uuid: uiExtension.localIdentifier, config: '{}', context: ''}],
      token: 'api-token',
      extensionIds: {},
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
      extensions: [{uuid: themeExtension.localIdentifier, config: '{"theme_extension":{"files":{}}}', context: ''}],
      token: 'api-token',
      extensionIds: {},
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
    vi.spyOn(functionExtension, 'preDeployValidation').mockImplementation(async () => {})

    const app = testApp({allExtensions: [functionExtension]})
    const moduleId = 'module-id'
    const mockedFunctionConfiguration = {
      title: functionExtension.configuration.name,
      module_id: moduleId,
      description: functionExtension.configuration.description,
      app_key: 'app-id',
      api_type: functionExtension.configuration.type,
      api_version: functionExtension.configuration.apiVersion,
      enable_creation_ui: true,
    }
    vi.mocked(uploadWasmBlob).mockResolvedValue({url: 'url', moduleId})

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
      extensions: [
        {
          uuid: functionExtension.localIdentifier,
          config: JSON.stringify(mockedFunctionConfiguration),
          context: '',
        },
      ],
      token: 'api-token',
      extensionIds: {},
      bundlePath: undefined,
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
      extensions: [
        {uuid: uiExtension.localIdentifier, config: '{}', context: ''},
        {uuid: themeExtension.localIdentifier, config: '{"theme_extension":{"files":{}}}', context: ''},
      ],
      token: 'api-token',
      extensionIds: {},
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
    await testDeployBundle(app, {
      id: 'app-id',
      organizationId: 'org-id',
      title: 'app-title',
      grantedScopes: [],
      betas: {unifiedAppDeployment: true},
    })

    // Then
    expect(renderSuccess).toHaveBeenCalledWith({
      body: {
        link: {
          label: 'Deployment 2',
          url: 'https://partners.shopify.com/org-id/apps/app-id/deployments/2',
        },
      },
      headline: 'Deployment created.',
      nextSteps: ['Publish your deployment to make your changes go live for merchants'],
    })
  })
})

async function testDeployBundle(
  app: AppInterface,
  partnersApp?: Omit<OrganizationApp, 'apiSecretKeys' | 'apiKey'>,
  options?: {
    force?: boolean
  },
) {
  // Given
  const extensionsPayload: {[key: string]: string} = {}
  for (const extension of app.allExtensions) {
    extensionsPayload[extension.localIdentifier] = extension.localIdentifier
  }
  const identifiers = {app: 'app-id', extensions: extensionsPayload, extensionIds: {}}

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
  })

  vi.mocked(useThemebundling).mockReturnValue(true)
  vi.mocked(uploadFunctionExtensions).mockResolvedValue(identifiers)
  vi.mocked(uploadExtensionsBundle).mockResolvedValue({validationErrors: [], deploymentId: 2})
  vi.mocked(updateAppIdentifiers).mockResolvedValue(app)
  vi.mocked(fetchAppExtensionRegistrations).mockResolvedValue({
    app: {extensionRegistrations: [], dashboardManagedExtensionRegistrations: [], functions: []},
  })

  await deploy({
    app,
    reset: false,
    force: Boolean(options?.force),
  })
}
