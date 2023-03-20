import {ensureDeployContext} from './context.js'
import {deploy} from './deploy.js'
import {uploadExtensionsBundle, uploadFunctionExtensions} from './deploy/upload.js'
import {bundleAndBuildExtensions} from './deploy/bundle.js'
import {fetchAppExtensionRegistrations} from './dev/fetch.js'
import {testApp, testThemeExtensions, testUIExtension} from '../models/app/app.test-data.js'
import {updateAppIdentifiers} from '../models/app/identifiers.js'
import {AppInterface} from '../models/app/app.js'
import {Organization} from '../models/organization.js'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {useThemebundling} from '@shopify/cli-kit/node/context/local'
import {renderSuccess, renderTasks, renderTextPrompt, Task} from '@shopify/cli-kit/node/ui'

vi.mock('./context.js')
vi.mock('./deploy/upload.js')
vi.mock('./deploy/bundle.js')
vi.mock('./dev/fetch.js')
vi.mock('../models/app/identifiers.js')
vi.mock('@shopify/cli-kit/node/context/local')
vi.mock('@shopify/cli-kit/node/ui')

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
  it('uploads the extension bundle with 1 UI extension', async () => {
    // Given
    const uiExtension = await testUIExtension({type: 'web_pixel_extension'})
    const app = testApp({extensions: {ui: [uiExtension], theme: [], function: [], configurations: []}})

    // When
    await testDeployBundle(app)

    // Then
    expect(uploadExtensionsBundle).toHaveBeenCalledWith({
      apiKey: 'app-id',
      bundlePath: expect.stringMatching(/bundle.zip$/),
      extensions: [{uuid: uiExtension.localIdentifier, config: '{}', context: ''}],
      token: 'api-token',
    })
  })

  it('uploads the extension bundle with 1 theme extension', async () => {
    // Given
    const themeExtension = await testThemeExtensions()
    const app = testApp({extensions: {ui: [], theme: [themeExtension], function: [], configurations: []}})

    // When
    await testDeployBundle(app)

    // Then
    expect(uploadExtensionsBundle).toHaveBeenCalledWith({
      apiKey: 'app-id',
      bundlePath: expect.stringMatching(/bundle.zip$/),
      extensions: [{uuid: themeExtension.localIdentifier, config: '{"theme_extension": {"files": {}}}', context: ''}],
      token: 'api-token',
    })
  })

  it('uploads the extension bundle with 1 UI and 1 theme extension', async () => {
    // Given
    const uiExtension = await testUIExtension({type: 'web_pixel_extension'})
    const themeExtension = await testThemeExtensions()
    const app = testApp({extensions: {ui: [uiExtension], theme: [themeExtension], function: [], configurations: []}})

    // When
    await testDeployBundle(app)

    // Then
    expect(uploadExtensionsBundle).toHaveBeenCalledWith({
      apiKey: 'app-id',
      bundlePath: expect.stringMatching(/bundle.zip$/),
      extensions: [
        {uuid: uiExtension.localIdentifier, config: '{}', context: ''},
        {uuid: themeExtension.localIdentifier, config: '{"theme_extension": {"files": {}}}', context: ''},
      ],
      token: 'api-token',
    })
  })

  it('passes a label to the deployment mutation', async () => {
    // Given
    const uiExtension = await testUIExtension({type: 'web_pixel_extension'})
    const app = testApp({extensions: {ui: [uiExtension], theme: [], function: [], configurations: []}})
    vi.mocked(renderTextPrompt).mockResolvedValue('Deployed from CLI')

    // When
    await testDeployBundle(app, {id: 'org-id', businessName: 'org-name', betas: {appUiDeployments: true}})

    // Then
    expect(uploadExtensionsBundle).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Deployed from CLI',
      }),
    )
  })

  it('shows a success message', async () => {
    // Given
    const uiExtension = await testUIExtension({type: 'web_pixel_extension'})
    const app = testApp({extensions: {ui: [uiExtension], theme: [], function: [], configurations: []}})

    // When
    await testDeployBundle(app, {id: 'org-id', businessName: 'org-name', betas: {appUiDeployments: false}})

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

  it('shows a specific success message when deploying using the unified app deployment flow', async () => {
    // Given
    const uiExtension = await testUIExtension({type: 'web_pixel_extension'})
    const app = testApp({extensions: {ui: [uiExtension], theme: [], function: [], configurations: []}})
    vi.mocked(renderTextPrompt).mockResolvedValue('Deployed from CLI')

    // When
    await testDeployBundle(app, {id: 'org-id', businessName: 'org-name', betas: {appUiDeployments: true}})

    // Then
    expect(renderSuccess).toHaveBeenCalledWith({
      body: {
        link: {
          label: 'Deployment 2',
          url: 'https://partners.shopify.com/org-id/apps/app-id/deployments/2',
        },
      },
      headline: 'Deployment created',
      nextSteps: ['Publish your deployment to make your changes go live for merchants'],
    })
  })
})

async function testDeployBundle(app: AppInterface, organization?: Organization) {
  // Given
  const extensionsPayload: {[key: string]: string} = {}
  for (const uiExtension of app.extensions.ui) {
    extensionsPayload[uiExtension.localIdentifier] = uiExtension.localIdentifier
  }
  for (const themeExtension of app.extensions.theme) {
    extensionsPayload[themeExtension.localIdentifier] = themeExtension.localIdentifier
  }
  const identifiers = {app: 'app-id', extensions: extensionsPayload, extensionIds: {}}

  vi.mocked(ensureDeployContext).mockResolvedValue({
    app,
    identifiers,
    partnersApp: {id: 'app-id', organizationId: 'org-id', title: 'app-title', grantedScopes: []},
    token: 'api-token',
    organization: organization ?? {id: 'org-id', businessName: 'org-name', betas: {appUiDeployments: false}},
  })
  vi.mocked(useThemebundling).mockReturnValue(true)
  vi.mocked(uploadFunctionExtensions).mockResolvedValue(identifiers)
  vi.mocked(uploadExtensionsBundle).mockResolvedValue({validationErrors: [], deploymentId: 2})
  vi.mocked(updateAppIdentifiers).mockResolvedValue(app)
  vi.mocked(fetchAppExtensionRegistrations).mockResolvedValue({app: {extensionRegistrations: [], functions: []}})

  // When
  await deploy({
    app,
    reset: false,
    force: true,
  })

  // Then
  expect(bundleAndBuildExtensions).toHaveBeenCalledOnce()
  expect(updateAppIdentifiers).toHaveBeenCalledOnce()
  expect(fetchAppExtensionRegistrations).toHaveBeenCalledOnce()
}
