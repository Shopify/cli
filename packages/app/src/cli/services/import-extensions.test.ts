import {importExtensions, filterOutImportedExtensions} from './import-extensions.js'
import {buildTomlObject} from './flow/extension-to-toml.js'
import {testAppLinked, testDeveloperPlatformClient, testUIExtension} from '../models/app/app.test-data.js'
import {OrganizationApp} from '../models/organization.js'
import {ExtensionRegistration} from '../api/graphql/all_app_extension_registrations.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import {fileExistsSync, inTemporaryDirectory, mkdir} from '@shopify/cli-kit/node/fs'
import {renderSelectPrompt, renderSuccess} from '@shopify/cli-kit/node/ui'
import {joinPath} from '@shopify/cli-kit/node/path'
import {AbortSilentError} from '@shopify/cli-kit/node/error'

vi.mock('@shopify/cli-kit/node/ui')
vi.mock('./context.js')
vi.mock('./fetch-extensions.js')
vi.mock('./context/partner-account-info.js')

const organizationApp: OrganizationApp = {
  id: 'id',
  title: 'title',
  apiKey: 'apiKey',
  organizationId: 'organizationId',
  apiSecretKeys: [],
  grantedScopes: [],
  flags: [],
  developerPlatformClient: testDeveloperPlatformClient(),
}

const flowExtensionA: ExtensionRegistration = {
  id: 'idA',
  title: 'titleA',
  uuid: 'uuidA',
  type: 'flow_action_definition',
  activeVersion: {
    config: '{}',
  },
}

const flowExtensionB: ExtensionRegistration = {
  id: 'idB',
  title: 'titleB',
  uuid: 'uuidB',
  type: 'flow_action_definition',
  activeVersion: {
    config: '{}',
  },
}

const marketingActivityExtension: ExtensionRegistration = {
  id: 'idC',
  title: 'titleC',
  uuid: 'uuidC',
  type: 'marketing_activity_extension',
  activeVersion: {
    config: '{}',
  },
}

const subscriptionLinkExtension: ExtensionRegistration = {
  id: 'idD',
  title: 'titleD',
  uuid: 'uuidD',
  type: 'subscription_link_extension',
  activeVersion: {
    config: '{}',
  },
}

const legacySubscriptionLinkExtension: ExtensionRegistration = {
  id: 'idE',
  title: 'titleE',
  uuid: 'uuidE',
  type: 'subscription_link',
  activeVersion: {
    config: '{}',
  },
}

describe('import-extensions', () => {
  beforeEach(() => {
    // eslint-disable-next-line @shopify/cli/no-vi-manual-mock-clear
    vi.clearAllMocks()
  })

  test('importing an extension creates a folder and toml file', async () => {
    // Given
    const extensions = [
      flowExtensionA,
      flowExtensionB,
      marketingActivityExtension,
      subscriptionLinkExtension,
      legacySubscriptionLinkExtension,
    ]
    const extensionRegistrations = [...extensions]

    vi.mocked(renderSelectPrompt).mockResolvedValue('uuidA')

    // When
    await inTemporaryDirectory(async (tmpDir) => {
      const app = testAppLinked({directory: tmpDir})

      await importExtensions({
        app,
        remoteApp: organizationApp,
        developerPlatformClient: testDeveloperPlatformClient(),
        extensionTypes: [
          'flow_action_definition',
          'flow_trigger_definition',
          'marketing_activity_extension',
          'subscription_link',
          'subscription_link_extension',
        ],
        extensions,
        buildTomlObject,
      })

      expect(renderSuccess).toHaveBeenCalledWith({
        headline: ['Imported the following extensions from the dashboard:'],
        body: '• "titleA" at: extensions/title-a',
      })

      // Then
      const tomlPathA = joinPath(tmpDir, 'extensions', 'title-a', 'shopify.extension.toml')
      expect(fileExistsSync(tomlPathA)).toBe(true)

      const tomlPathB = joinPath(tmpDir, 'extensions', 'title-b', 'shopify.extension.toml')
      expect(fileExistsSync(tomlPathB)).toBe(false)

      const tomlPathC = joinPath(tmpDir, 'extensions', 'title-c', 'shopify.extension.toml')
      expect(fileExistsSync(tomlPathC)).toBe(false)

      const tomlPathD = joinPath(tmpDir, 'extensions', 'title-d', 'shopify.extension.toml')
      expect(fileExistsSync(tomlPathD)).toBe(false)

      const tomlPathE = joinPath(tmpDir, 'extensions', 'title-e', 'shopify.extension.toml')
      expect(fileExistsSync(tomlPathE)).toBe(false)
    })
  })

  test('handles existing directory with user prompt - skip', async () => {
    // Given
    const extensions = [flowExtensionA]

    // When
    await inTemporaryDirectory(async (tmpDir) => {
      const app = testAppLinked({directory: tmpDir})

      // Create the extensions directory
      const extensionsDir = joinPath(tmpDir, 'extensions')
      await mkdir(extensionsDir)

      // Create the specific extension directory
      const extensionDir = joinPath(extensionsDir, 'title-a')
      await mkdir(extensionDir)

      // Mock prompts:
      // 1. First prompt: select which extension to migrate (select flowExtensionA by its UUID)
      // 2. Second prompt: what to do with existing directory (select skip)
      vi.mocked(renderSelectPrompt)
        // Select flowExtensionA
        .mockResolvedValueOnce('uuidA')
        // Skip existing directory
        .mockResolvedValueOnce('skip')

      await importExtensions({
        app,
        remoteApp: organizationApp,
        developerPlatformClient: testDeveloperPlatformClient(),
        extensionTypes: ['flow_action_definition'],
        extensions,
        buildTomlObject,
      })

      // Then - expect the success message to be shown (even for skipped extensions)
      expect(renderSuccess).toHaveBeenCalledWith({
        headline: ['Imported the following extensions from the dashboard:'],
        body: '• "titleA" at: extensions/title-a',
      })

      // The toml file should not be created since we skipped
      const tomlPathA = joinPath(tmpDir, 'extensions', 'title-a', 'shopify.extension.toml')
      expect(fileExistsSync(tomlPathA)).toBe(false)
    })
  })

  test('handles existing directory with write option', async () => {
    // Given
    const extensions = [flowExtensionA]

    // When
    await inTemporaryDirectory(async (tmpDir) => {
      const app = testAppLinked({directory: tmpDir})

      // Create the extensions directory
      const extensionsDir = joinPath(tmpDir, 'extensions')
      await mkdir(extensionsDir)

      // Create the specific extension directory
      const extensionDir = joinPath(extensionsDir, 'title-a')
      await mkdir(extensionDir)

      // Mock prompts:
      // 1. First prompt: select which extension to migrate (select flowExtensionA by its UUID)
      // 2. Second prompt: what to do with existing directory (select write)
      vi.mocked(renderSelectPrompt)
        // Select flowExtensionA
        .mockResolvedValueOnce('uuidA')
        // Write/overwrite existing directory
        .mockResolvedValueOnce('write')

      await importExtensions({
        app,
        remoteApp: organizationApp,
        developerPlatformClient: testDeveloperPlatformClient(),
        extensionTypes: ['flow_action_definition'],
        extensions,
        buildTomlObject,
      })

      // Then - expect the success message to be shown
      expect(renderSuccess).toHaveBeenCalledWith({
        headline: ['Imported the following extensions from the dashboard:'],
        body: '• "titleA" at: extensions/title-a',
      })

      // The toml file should be created since we wrote/overwrote
      const tomlPathA = joinPath(tmpDir, 'extensions', 'title-a', 'shopify.extension.toml')
      expect(fileExistsSync(tomlPathA)).toBe(true)
    })
  })

  test('handles existing directory with cancel option', async () => {
    // Given
    const extensions = [flowExtensionA]

    // When
    await inTemporaryDirectory(async (tmpDir) => {
      const app = testAppLinked({directory: tmpDir})

      // Create the extensions directory
      const extensionsDir = joinPath(tmpDir, 'extensions')
      await mkdir(extensionsDir)

      // Create the specific extension directory
      const extensionDir = joinPath(extensionsDir, 'title-a')
      await mkdir(extensionDir)

      // Mock prompts:
      // 1. First prompt: select which extension to migrate (select flowExtensionA by its UUID)
      // 2. Second prompt: what to do with existing directory (select cancel)
      vi.mocked(renderSelectPrompt)
        // Select flowExtensionA
        .mockResolvedValueOnce('uuidA')
        // Cancel the operation
        .mockResolvedValueOnce('cancel')

      // Then - expect the function to throw an AbortSilentError
      await expect(
        importExtensions({
          app,
          remoteApp: organizationApp,
          developerPlatformClient: testDeveloperPlatformClient(),
          extensionTypes: ['flow_action_definition'],
          extensions,
          buildTomlObject,
        }),
      ).rejects.toThrow(AbortSilentError)

      // The toml file should not be created since we cancelled
      const tomlPathA = joinPath(tmpDir, 'extensions', 'title-a', 'shopify.extension.toml')
      expect(fileExistsSync(tomlPathA)).toBe(false)
    })
  })

  test('selecting All imports all extensions', async () => {
    // Given
    const extensions = [
      flowExtensionA,
      flowExtensionB,
      marketingActivityExtension,
      subscriptionLinkExtension,
      legacySubscriptionLinkExtension,
    ]
    const extensionRegistrations = [...extensions]

    vi.mocked(renderSelectPrompt).mockResolvedValue('All')

    // When
    await inTemporaryDirectory(async (tmpDir) => {
      const app = testAppLinked({directory: tmpDir})

      await importExtensions({
        app,
        remoteApp: organizationApp,
        developerPlatformClient: testDeveloperPlatformClient(),
        extensionTypes: [
          'flow_action_definition',
          'flow_trigger_definition',
          'marketing_activity_extension',
          'subscription_link',
          'subscription_link_extension',
        ],
        extensions,
        buildTomlObject,
      })

      expect(renderSuccess).toHaveBeenCalledWith({
        headline: ['Imported the following extensions from the dashboard:'],
        body: '• "titleA" at: extensions/title-a\n• "titleB" at: extensions/title-b\n• "titleC" at: extensions/title-c\n• "titleD" at: extensions/title-d\n• "titleE" at: extensions/title-e',
      })

      // Then
      const tomlPathA = joinPath(tmpDir, 'extensions', 'title-a', 'shopify.extension.toml')
      expect(fileExistsSync(tomlPathA)).toBe(true)

      const tomlPathB = joinPath(tmpDir, 'extensions', 'title-b', 'shopify.extension.toml')
      expect(fileExistsSync(tomlPathB)).toBe(true)

      const tomlPathC = joinPath(tmpDir, 'extensions', 'title-c', 'shopify.extension.toml')
      expect(fileExistsSync(tomlPathC)).toBe(true)

      const tomlPathD = joinPath(tmpDir, 'extensions', 'title-d', 'shopify.extension.toml')
      expect(fileExistsSync(tomlPathD)).toBe(true)

      const tomlPathE = joinPath(tmpDir, 'extensions', 'title-e', 'shopify.extension.toml')
      expect(fileExistsSync(tomlPathE)).toBe(true)
    })
  })

  test('Show message if there are not extensions to migrate', async () => {
    // Given
    const extensions: ExtensionRegistration[] = []
    const extensionRegistrations: ExtensionRegistration[] = []

    // When/Then
    await inTemporaryDirectory(async (tmpDir) => {
      const app = testAppLinked({directory: tmpDir})

      // The function should throw an error when there are no extensions to migrate
      await expect(
        importExtensions({
          app,
          remoteApp: organizationApp,
          developerPlatformClient: testDeveloperPlatformClient(),
          extensionTypes: [
            'flow_action_definition',
            'flow_trigger_definition',
            'marketing_activity_extension',
            'subscription_link',
            'subscription_link_extension',
          ],
          extensions,
          buildTomlObject,
        }),
      ).rejects.toThrow('No extensions to migrate')

      // renderSelectPrompt should not be called when there are no extensions
      expect(renderSelectPrompt).not.toHaveBeenCalled()

      const tomlPathA = joinPath(tmpDir, 'extensions', 'title-a', 'shopify.extension.toml')
      expect(fileExistsSync(tomlPathA)).toBe(false)

      const tomlPathB = joinPath(tmpDir, 'extensions', 'title-b', 'shopify.extension.toml')
      expect(fileExistsSync(tomlPathB)).toBe(false)

      const tomlPathC = joinPath(tmpDir, 'extensions', 'title-c', 'shopify.extension.toml')
      expect(fileExistsSync(tomlPathC)).toBe(false)

      const tomlPathD = joinPath(tmpDir, 'extensions', 'title-d', 'shopify.extension.toml')
      expect(fileExistsSync(tomlPathD)).toBe(false)

      const tomlPathE = joinPath(tmpDir, 'extensions', 'title-e', 'shopify.extension.toml')
      expect(fileExistsSync(tomlPathE)).toBe(false)
    })
  })
})

describe('filterOutImportedExtensions', () => {
  test('filters out extensions that are already imported', async () => {
    // Given
    const extensionA = await testUIExtension({handle: 'my-extension-a'})
    const extensionB = await testUIExtension({handle: 'my-extension-b'})

    const app = testAppLinked({
      dotenv: {
        path: '.env',
        variables: {
          SHOPIFY_MY_EXTENSION_A_ID: 'uuidA',
          SHOPIFY_MY_EXTENSION_B_ID: 'uuidB',
          SHOPIFY_SOME_OTHER_ID: 'someOtherId',
        },
      },
      allExtensions: [extensionA, extensionB],
    })

    const extensions = [flowExtensionA, flowExtensionB, marketingActivityExtension]

    // When
    const result = filterOutImportedExtensions(app, extensions)

    // Then
    expect(result).toEqual([marketingActivityExtension])
  })
})
