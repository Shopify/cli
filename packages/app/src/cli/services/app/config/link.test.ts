import link, {LinkOptions} from './link.js'
import {saveCurrentConfig} from './use.js'
import {testApp, testOrganizationApp} from '../../../models/app/app.test-data.js'
import {selectConfigName} from '../../../prompts/config.js'
import {load} from '../../../models/app/loader.js'
import {fetchOrCreateOrganizationApp} from '../../context.js'
import {fetchAppFromApiKey} from '../../dev/fetch.js'
import {describe, expect, test, vi} from 'vitest'
import {Config} from '@oclif/core'
import {fileExistsSync, inTemporaryDirectory, readFile, writeFileSync} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'

const LOCAL_APP = testApp()
const REMOTE_APP = testOrganizationApp()

vi.mock('./use.js')
vi.mock('../../../prompts/config.js')
vi.mock('../../../models/app/loader.js')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('../../dev/fetch.js')
vi.mock('../../context.js', async () => {
  const context: any = await vi.importActual('../../context.js')
  return {
    ...context,
    fetchOrCreateOrganizationApp: vi.fn(),
  }
})

describe('link', () => {
  test('does not ask for a name when it is provided as a flag', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const options: LinkOptions = {
        directory: tmp,
        commandConfig: {runHook: vi.fn(() => Promise.resolve({successes: []}))} as unknown as Config,
        configName: 'Default value',
      }
      vi.mocked(load).mockResolvedValue(LOCAL_APP)
      vi.mocked(fetchOrCreateOrganizationApp).mockResolvedValue(REMOTE_APP)

      // When
      await link(options)

      // Then
      expect(selectConfigName).not.toHaveBeenCalled()
      expect(fileExistsSync(joinPath(tmp, 'shopify.app.default-value.toml'))).toBeTruthy()
    })
  })

  test('creates a new config file when it does not exist', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const options: LinkOptions = {
        directory: tmp,
        commandConfig: {runHook: vi.fn(() => Promise.resolve({successes: []}))} as unknown as Config,
      }
      vi.mocked(load).mockResolvedValue(LOCAL_APP)
      vi.mocked(fetchOrCreateOrganizationApp).mockResolvedValue(REMOTE_APP)
      vi.mocked(selectConfigName).mockResolvedValue('staging')

      // When
      await link(options)

      // Then
      const content = await readFile(joinPath(tmp, 'shopify.app.staging.toml'))
      const expectedContent = `scopes = ""
extension_directories = [ ]
client_id = "api-key"
name = "app1"
application_url = "https://example.com"
webhook_api_version = "2023-04"
api_contact_email = "example@example.com"
`
      expect(content).toEqual(expectedContent)
      expect(saveCurrentConfig).toHaveBeenCalledWith({configFileName: 'shopify.app.staging.toml', directory: tmp})
      expect(renderSuccess).toHaveBeenCalledWith({
        headline: 'App "app1" connected to this codebase, file shopify.app.staging.toml created',
      })
    })
  })

  test('updates the config file when it already exists', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const filePath = joinPath(tmp, 'shopify.app.staging.toml')
      const initialContent = `scopes = ""

      [appInfo]
      name = "other-app"
      `
      writeFileSync(filePath, initialContent)
      const options: LinkOptions = {
        directory: tmp,
        commandConfig: {runHook: vi.fn(() => Promise.resolve({successes: []}))} as unknown as Config,
      }
      vi.mocked(load).mockResolvedValue(LOCAL_APP)
      vi.mocked(fetchOrCreateOrganizationApp).mockResolvedValue(REMOTE_APP)
      vi.mocked(selectConfigName).mockResolvedValue('staging')

      // When
      await link(options)

      // Then
      const content = await readFile(joinPath(tmp, 'shopify.app.staging.toml'))
      const expectedContent = `scopes = ""
extension_directories = [ ]
client_id = "api-key"
name = "app1"
application_url = "https://example.com"
webhook_api_version = "2023-04"
api_contact_email = "example@example.com"
`
      expect(content).toEqual(expectedContent)
      expect(renderSuccess).toHaveBeenCalledWith({
        headline: 'App "app1" connected to this codebase, file shopify.app.staging.toml updated',
      })
    })
  })

  test('fetches the app directly when an api key is provided', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const options: LinkOptions = {
        directory: tmp,
        commandConfig: {runHook: vi.fn(() => Promise.resolve({successes: []}))} as unknown as Config,
        apiKey: 'api-key',
      }
      vi.mocked(load).mockResolvedValue(LOCAL_APP)
      vi.mocked(ensureAuthenticatedPartners).mockResolvedValue('token')
      vi.mocked(fetchAppFromApiKey).mockResolvedValue(REMOTE_APP)
      vi.mocked(selectConfigName).mockResolvedValue('staging')

      // When
      await link(options)

      // Then
      expect(fetchAppFromApiKey).toHaveBeenCalledWith('api-key', 'token')
    })
  })

  test('throws an error when an invalid api key is is provided', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const options: LinkOptions = {
        directory: tmp,
        commandConfig: {runHook: vi.fn(() => Promise.resolve({successes: []}))} as unknown as Config,
        apiKey: '1234-5678',
      }
      vi.mocked(load).mockResolvedValue(LOCAL_APP)
      vi.mocked(ensureAuthenticatedPartners).mockResolvedValue('token')
      vi.mocked(fetchAppFromApiKey).mockResolvedValue(undefined)
      vi.mocked(selectConfigName).mockResolvedValue('staging')

      // When
      const result = link(options)

      // Then
      await expect(result).rejects.toThrow(/Invalid Client ID/)
    })
  })

  test('generates the file when there is no shopify.app.toml', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const options: LinkOptions = {
        directory: tmp,
        commandConfig: {runHook: vi.fn(() => Promise.resolve({successes: []}))} as unknown as Config,
      }
      vi.mocked(load).mockRejectedValue(new Error('Shopify.app.toml not found'))
      vi.mocked(fetchOrCreateOrganizationApp).mockResolvedValue(REMOTE_APP)
      vi.mocked(selectConfigName).mockResolvedValue('staging')

      // When
      await link(options)

      // Then
      const content = await readFile(joinPath(tmp, 'shopify.app.staging.toml'))
      const expectedContent = `client_id = "api-key"
name = "app1"
application_url = "https://example.com"
webhook_api_version = "2023-04"
api_contact_email = "example@example.com"
`
      expect(content).toEqual(expectedContent)
    })
  })
})
