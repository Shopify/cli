import {importExtensions} from './import-extensions.js'
import {getExtensions} from './fetch-extensions.js'
import {buildTomlObject} from './flow/extension-to-toml.js'
import {testAppLinked, testDeveloperPlatformClient} from '../models/app/app.test-data.js'
import {OrganizationApp} from '../models/organization.js'
import {ExtensionRegistration} from '../api/graphql/all_app_extension_registrations.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import {fileExistsSync, inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {renderSelectPrompt, renderSuccess} from '@shopify/cli-kit/node/ui'
import {joinPath} from '@shopify/cli-kit/node/path'

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
    vi.mocked(getExtensions).mockResolvedValue([
      flowExtensionA,
      flowExtensionB,
      marketingActivityExtension,
      subscriptionLinkExtension,
    ])
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
        ],
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
    })
  })

  test('selecting All imports all extensions', async () => {
    // Given
    vi.mocked(getExtensions).mockResolvedValue([
      flowExtensionA,
      flowExtensionB,
      marketingActivityExtension,
      subscriptionLinkExtension,
    ])
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
        ],
        buildTomlObject,
      })

      expect(renderSuccess).toHaveBeenCalledWith({
        headline: ['Imported the following extensions from the dashboard:'],
        body: '• "titleA" at: extensions/title-a\n• "titleB" at: extensions/title-b\n• "titleC" at: extensions/title-c\n• "titleD" at: extensions/title-d',
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
    })
  })

  test('Show message if there are not extensions to migrate', async () => {
    // Given
    vi.mocked(getExtensions).mockResolvedValue([])

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
        ],
        buildTomlObject,
      })

      // Then
      expect(renderSelectPrompt).not.toHaveBeenCalled()

      expect(renderSuccess).toHaveBeenCalledWith({
        headline: ['No extensions to migrate.'],
      })

      const tomlPathA = joinPath(tmpDir, 'extensions', 'title-a', 'shopify.extension.toml')
      expect(fileExistsSync(tomlPathA)).toBe(false)

      const tomlPathB = joinPath(tmpDir, 'extensions', 'title-b', 'shopify.extension.toml')
      expect(fileExistsSync(tomlPathB)).toBe(false)

      const tomlPathC = joinPath(tmpDir, 'extensions', 'title-c', 'shopify.extension.toml')
      expect(fileExistsSync(tomlPathC)).toBe(false)

      const tomlPathD = joinPath(tmpDir, 'extensions', 'title-d', 'shopify.extension.toml')
      expect(fileExistsSync(tomlPathD)).toBe(false)
    })
  })
})
