import link, {LinkOptions} from './link.js'
import {OrganizationApp} from '../../../models/organization.js'
import {testApp} from '../../../models/app/app.test-data.js'
import {selectConfigName} from '../../../prompts/config.js'
import {load} from '../../../models/app/loader.js'
import {fetchOrCreateOrganizationApp} from '../../context.js'
import {fetchAppFromApiKey} from '../../dev/fetch.js'
import {describe, expect, test, vi} from 'vitest'
import {Config} from '@oclif/core'
import {inTemporaryDirectory, readFile, writeFileSync} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'

const LOCAL_APP = testApp()
const REMOTE_APP: OrganizationApp = {
  id: '1',
  title: 'app1',
  apiKey: 'api-key',
  apiSecretKeys: [{secret: 'secret1'}],
  organizationId: '1',
  grantedScopes: [],
  applicationUrl: 'https://example.com',
}

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
extensionDirectories = [ ]
clientId = "api-key"
name = "app1"
applicationUrl = "https://example.com"
`
      expect(content).toEqual(expectedContent)
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
extensionDirectories = [ ]
clientId = "api-key"
name = "app1"
applicationUrl = "https://example.com"
`
      expect(content).toEqual(expectedContent)
      expect(renderSuccess).toHaveBeenCalledWith({
        headline: 'App "app1" connected to this codebase, file shopify.app.staging.toml updated',
      })
    })
  })

  test('uses the name flag as the default value for the config name', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const options: LinkOptions = {
        directory: tmp,
        commandConfig: {runHook: vi.fn(() => Promise.resolve({successes: []}))} as unknown as Config,
        configName: 'default value',
      }
      vi.mocked(load).mockResolvedValue(LOCAL_APP)
      vi.mocked(fetchOrCreateOrganizationApp).mockResolvedValue(REMOTE_APP)
      vi.mocked(selectConfigName).mockResolvedValue('staging')

      // When
      await link(options)

      // Then
      expect(selectConfigName).toHaveBeenCalledWith(tmp, 'default value')
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
        apiKey: 'api-key',
      }
      vi.mocked(load).mockResolvedValue(LOCAL_APP)
      vi.mocked(ensureAuthenticatedPartners).mockResolvedValue('token')
      vi.mocked(fetchAppFromApiKey).mockResolvedValue(undefined)
      vi.mocked(selectConfigName).mockResolvedValue('staging')

      // When
      const result = link(options)

      // Then
      await expect(result).rejects.toThrow(/Invalid API key/)
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
      const expectedContent = `clientId = "api-key"
name = "app1"
applicationUrl = "https://example.com"
`
      expect(content).toEqual(expectedContent)
    })
  })
})
