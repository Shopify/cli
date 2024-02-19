import {importFlowExtensions} from './import-flow-legacy-extensions.js'
import {fetchAppAndIdentifiers} from './context.js'
import {getActiveDashboardExtensions} from './flow/fetch-flow-dashboard-extensions.js'
import {fetchPartnersSession} from './context/partner-account-info.js'
import {testPartnersUserSession, testApp} from '../models/app/app.test-data.js'
import {OrganizationApp} from '../models/organization.js'
import {ExtensionRegistration} from '../api/graphql/all_app_extension_registrations.js'
import {describe, expect, test, vi} from 'vitest'
import {fileExistsSync, inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {renderSelectPrompt, renderSuccess} from '@shopify/cli-kit/node/ui'
import {joinPath} from '@shopify/cli-kit/node/path'

vi.mock('@shopify/cli-kit/node/ui')
vi.mock('./context.js')
vi.mock('./flow/fetch-flow-dashboard-extensions.js')
vi.mock('./context/partner-account-info.js')

const organizationApp: OrganizationApp = {
  id: 'id',
  title: 'title',
  apiKey: 'apiKey',
  organizationId: 'organizationId',
  apiSecretKeys: [],
  grantedScopes: [],
  betas: [],
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

describe('import-flow-legacy-extensions', () => {
  test('importing an extension creates a folder and toml file', async () => {
    // Given
    vi.mocked(fetchPartnersSession).mockResolvedValue(testPartnersUserSession)
    vi.mocked(fetchAppAndIdentifiers).mockResolvedValue([organizationApp, {}])
    vi.mocked(getActiveDashboardExtensions).mockResolvedValue([flowExtensionA, flowExtensionB])
    vi.mocked(renderSelectPrompt).mockResolvedValue('uuidA')

    // When
    await inTemporaryDirectory(async (tmpDir) => {
      const app = testApp({directory: tmpDir})

      await importFlowExtensions({app})

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
    vi.mocked(fetchPartnersSession).mockResolvedValue(testPartnersUserSession)
    vi.mocked(fetchAppAndIdentifiers).mockResolvedValue([organizationApp, {}])
    vi.mocked(getActiveDashboardExtensions).mockResolvedValue([flowExtensionA, flowExtensionB])
    vi.mocked(renderSelectPrompt).mockResolvedValue('All')

    // When
    await inTemporaryDirectory(async (tmpDir) => {
      const app = testApp({directory: tmpDir})

      await importFlowExtensions({app})

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
    vi.mocked(fetchPartnersSession).mockResolvedValue(testPartnersUserSession)
    vi.mocked(fetchAppAndIdentifiers).mockResolvedValue([organizationApp, {}])
    vi.mocked(getActiveDashboardExtensions).mockResolvedValue([])

    // When
    await inTemporaryDirectory(async (tmpDir) => {
      const app = testApp({directory: tmpDir})

      await importFlowExtensions({app})

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
