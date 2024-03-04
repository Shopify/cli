import {draftExtensionsPush} from './push.js'
import {DraftExtensionsPushOptions, enableDeveloperPreview, ensureDraftExtensionsPushContext} from '../context.js'
import {updateExtensionDraft} from '../dev/update-extension.js'
import {buildFunctionExtension, buildUIExtension} from '../build/extension.js'
import {
  testApp,
  testUIExtension,
  testFunctionExtension,
  testAppConfigExtensions,
  testDeveloperPlatformClient,
} from '../../models/app/app.test-data.js'
import {AppInterface} from '../../models/app/app.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {describe, expect, test, vi} from 'vitest'
import {exec} from '@shopify/cli-kit/node/system'

vi.mock('../context.js')
vi.mock('../build/extension.js')
vi.mock('../dev/update-extension.js')
vi.mock('@shopify/cli-kit/node/system')

const draftExtensionsPushOptions = (app: AppInterface): DraftExtensionsPushOptions => {
  return {
    directory: app.directory,
    reset: false,
    enableDeveloperPreview: false,
  }
}
const validUiExtension = await testUIExtension({
  configuration: {
    extension_points: [],
    type: 'ui_extension',
    handle: 'ui_extension_identifier',
  },
})
const validFunctionExtension = await testFunctionExtension({
  config: {
    name: 'jsfunction',
    type: 'function',
    api_version: '2023-07',
    configuration_ui: true,
    metafields: [],
    build: {},
  },
  entryPath: 'src/index.js',
})
const remoteExtensionIds = {
  ui_extension_identifier: 'remote-ui-extension-id',
  jsfunction: 'remote-function-extension-id',
}
const remoteApp = {
  id: 'app-id',
  title: 'app-title',
  apiKey: 'api-key',
  organizationId: 'org-id',
  grantedScopes: [],
  applicationUrl: 'https://example.com',
  redirectUrlWhitelist: [],
  apiSecretKeys: [],
  betas: [],
}

const developerPlatformClient: DeveloperPlatformClient = testDeveloperPlatformClient()

describe('draftExtensionsPush', () => {
  test("do nothing if the app doesn't include any extension", async () => {
    // Given
    const app = testApp({
      allExtensions: [],
    })
    vi.mocked(ensureDraftExtensionsPushContext).mockResolvedValue({
      app,
      developerPlatformClient,
      remoteExtensionIds,
      remoteApp,
    })

    // When
    await draftExtensionsPush(draftExtensionsPushOptions(app))

    // Then
    expect(updateExtensionDraft).not.toHaveBeenCalledOnce()
    expect(enableDeveloperPreview).not.toHaveBeenCalled()
  })

  test('do nothing if the app includes only app config extensions', async () => {
    // Given
    const app = testApp({
      allExtensions: [await testAppConfigExtensions()],
    })
    vi.mocked(ensureDraftExtensionsPushContext).mockResolvedValue({
      app,
      developerPlatformClient,
      remoteExtensionIds,
      remoteApp,
    })

    // When
    await draftExtensionsPush(draftExtensionsPushOptions(app))

    // Then
    expect(updateExtensionDraft).not.toHaveBeenCalledOnce()
    expect(enableDeveloperPreview).not.toHaveBeenCalled()
  })

  test('build and deploy draft content with ui extension', async () => {
    // Given
    const app = testApp({
      allExtensions: [validUiExtension],
    })
    vi.mocked(ensureDraftExtensionsPushContext).mockResolvedValue({
      app,
      developerPlatformClient,
      remoteExtensionIds,
      remoteApp,
    })
    vi.mocked(buildUIExtension).mockResolvedValue()
    vi.mocked(updateExtensionDraft).mockResolvedValue()

    // When
    await draftExtensionsPush(draftExtensionsPushOptions(app))

    // Then
    expect(updateExtensionDraft).toHaveBeenCalledOnce()
    expect(enableDeveloperPreview).not.toHaveBeenCalled()
  })

  test('install javy, build and deploy draft content with a js function extension', async () => {
    // Given
    const app = testApp({
      allExtensions: [validFunctionExtension],
    })
    vi.mocked(ensureDraftExtensionsPushContext).mockResolvedValue({
      app,
      developerPlatformClient,
      remoteExtensionIds,
      remoteApp,
    })
    vi.mocked(buildFunctionExtension).mockResolvedValue()
    vi.mocked(updateExtensionDraft).mockResolvedValue()

    // When
    await draftExtensionsPush(draftExtensionsPushOptions(app))

    // Then
    expect(vi.mocked(exec)).toHaveBeenCalledWith('npm', ['exec', '--', 'javy-cli', '--version'], {cwd: app.directory})
    expect(updateExtensionDraft).toHaveBeenCalledOnce()
    expect(enableDeveloperPreview).not.toHaveBeenCalled()
  })

  test('enabled develop preview if the flag is used', async () => {
    // Given
    const app = testApp({
      allExtensions: [],
    })
    vi.mocked(ensureDraftExtensionsPushContext).mockResolvedValue({
      app,
      developerPlatformClient,
      remoteExtensionIds,
      remoteApp,
    })

    // When
    await draftExtensionsPush({...draftExtensionsPushOptions(app), enableDeveloperPreview: true})

    // Then
    expect(updateExtensionDraft).not.toHaveBeenCalledOnce()
    expect(enableDeveloperPreview).toHaveBeenCalled()
  })
})
