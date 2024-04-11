import {importExtensions} from './import-extensions.js'
import {fetchAppAndIdentifiers} from './context.js'
import {getExtensions} from './fetch-extensions.js'
import {buildTomlObject} from './flow/extension-to-toml.js'
import {testApp, testDeveloperPlatformClient} from '../models/app/app.test-data.js'
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

describe('import-extensions', () => {
  beforeEach(() => {
    // eslint-disable-next-line @shopify/cli/no-vi-manual-mock-clear
    vi.clearAllMocks()
  })

  test('importing an extension creates a folder and toml file', async () => {
    // Given
    vi.mocked(fetchAppAndIdentifiers).mockResolvedValue([organizationApp, {}])
    vi.mocked(getExtensions).mockResolvedValue([flowExtensionA, flowExtensionB])
    vi.mocked(renderSelectPrompt).mockResolvedValue('uuidA')

    // When
    await inTemporaryDirectory(async (tmpDir) => {
      const app = testApp({directory: tmpDir})

      await importExtensions({
        app,
        developerPlatformClient: testDeveloperPlatformClient(),
        extensionTypes: ['flow_action_definition', 'flow_trigger_definition'],
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
    })
  })

  test('selecting All imports all extensions', async () => {
    // Given
    vi.mocked(fetchAppAndIdentifiers).mockResolvedValue([organizationApp, {}])
    vi.mocked(getExtensions).mockResolvedValue([flowExtensionA, flowExtensionB])
    vi.mocked(renderSelectPrompt).mockResolvedValue('All')

    // When
    await inTemporaryDirectory(async (tmpDir) => {
      const app = testApp({directory: tmpDir})

      await importExtensions({
        app,
        developerPlatformClient: testDeveloperPlatformClient(),
        extensionTypes: ['flow_action_definition', 'flow_trigger_definition'],
        buildTomlObject,
      })

      expect(renderSuccess).toHaveBeenCalledWith({
        headline: ['Imported the following extensions from the dashboard:'],
        body: '• "titleA" at: extensions/title-a\n• "titleB" at: extensions/title-b',
      })

      // Then
      const tomlPathA = joinPath(tmpDir, 'extensions', 'title-a', 'shopify.extension.toml')
      expect(fileExistsSync(tomlPathA)).toBe(true)

      const tomlPathB = joinPath(tmpDir, 'extensions', 'title-b', 'shopify.extension.toml')
      expect(fileExistsSync(tomlPathB)).toBe(true)
    })
  })

  test('Show message if there are not extensions to migrate', async () => {
    // Given
    vi.mocked(fetchAppAndIdentifiers).mockResolvedValue([organizationApp, {}])
    vi.mocked(getExtensions).mockResolvedValue([])

    // When
    await inTemporaryDirectory(async (tmpDir) => {
      const app = testApp({directory: tmpDir})
      await importExtensions({
        app,
        developerPlatformClient: testDeveloperPlatformClient(),
        extensionTypes: ['flow_action_definition', 'flow_trigger_definition'],
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
    })
  })
})
