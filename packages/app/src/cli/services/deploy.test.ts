import {ensureDeployContext} from './context.js'
import {deploy} from './deploy.js'
import {uploadExtensionsBundle, uploadFunctionExtensions} from './deploy/upload.js'
import {bundleAndBuildExtensions} from './deploy/bundle.js'
import {fetchAppExtensionRegistrations} from './dev/fetch.js'
import {testApp, testThemeExtensions, testUIExtension} from '../models/app/app.test-data.js'
import {updateAppIdentifiers} from '../models/app/identifiers.js'
import {AppInterface} from '../models/app/app.js'
import {describe, expect, it, vi} from 'vitest'
import {useThemebundling} from '@shopify/cli-kit/node/context/local'

vi.mock('./context.js')
vi.mock('./deploy/upload.js')
vi.mock('./deploy/bundle.js')
vi.mock('./dev/fetch.js')
vi.mock('../models/app/identifiers.js')

describe('deploy', () => {
  it('uploads the extension bundle with 1 UI extension', async () => {
    // Given
    const uiExtension = await testUIExtension({type: 'web_pixel_extension'})
    const app = testApp({extensions: {ui: [uiExtension], theme: [], function: []}})

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
    const app = testApp({extensions: {ui: [], theme: [themeExtension], function: []}})

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
    const app = testApp({extensions: {ui: [uiExtension], theme: [themeExtension], function: []}})

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
})

async function testDeployBundle(app: AppInterface) {
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
    partnersOrganizationId: '',
    token: 'api-token',
  })
  vi.mock('@shopify/cli-kit/node/context/local')
  vi.mocked(useThemebundling).mockReturnValue(true)
  vi.mocked(uploadFunctionExtensions).mockResolvedValue(identifiers)
  vi.mocked(uploadExtensionsBundle).mockResolvedValue([])
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
