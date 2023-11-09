import link, {LinkOptions} from './link.js'
import {saveCurrentConfig} from './use.js'
import {testPartnersUserSession, testApp, testOrganizationApp} from '../../../models/app/app.test-data.js'
import {selectConfigName} from '../../../prompts/config.js'
import {loadApp} from '../../../models/app/loader.js'
import {InvalidApiKeyErrorMessage, fetchOrCreateOrganizationApp} from '../../context.js'
import {fetchAppDetailsFromApiKey} from '../../dev/fetch.js'
import {getCachedCommandInfo} from '../../local-storage.js'
import {fetchPartnersSession} from '../../context/partner-account-info.js'
import {describe, expect, test, vi} from 'vitest'
import {Config} from '@oclif/core'
import {fileExistsSync, inTemporaryDirectory, readFile, writeFileSync} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {outputContent} from '@shopify/cli-kit/node/output'

const LOCAL_APP = testApp()
const REMOTE_APP = testOrganizationApp()

vi.mock('./use.js')
vi.mock('../../../prompts/config.js')
vi.mock('../../../models/app/loader.js', async () => {
  const loader: any = await vi.importActual('../../../models/app/loader.js')
  return {
    ...loader,
    loadApp: vi.fn(),
  }
})
vi.mock('../../local-storage')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('../../context/partner-account-info.js')
vi.mock('../../dev/fetch.js')
vi.mock('../../context.js')

describe('link', () => {
  test('does not ask for a name when it is provided as a flag', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const options: LinkOptions = {
        directory: tmp,
        commandConfig: {runHook: vi.fn(() => Promise.resolve({successes: []}))} as unknown as Config,
        configName: 'Default value',
      }
      vi.mocked(loadApp).mockResolvedValue({...LOCAL_APP, directory: tmp})
      vi.mocked(fetchOrCreateOrganizationApp).mockResolvedValue(REMOTE_APP)

      // When
      await link(options)

      // Then
      expect(selectConfigName).not.toHaveBeenCalled()
      expect(fileExistsSync(joinPath(tmp, 'shopify.app.default-value.toml'))).toBeTruthy()
    })
  })

  test('creates a new shopify.app.toml file when it does not exist', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const options: LinkOptions = {
        directory: tmp,
        commandConfig: {runHook: vi.fn(() => Promise.resolve({successes: []}))} as unknown as Config,
      }
      vi.mocked(loadApp).mockRejectedValue('App not found')
      vi.mocked(fetchOrCreateOrganizationApp).mockResolvedValue(REMOTE_APP)

      // When
      await link(options)

      // Then
      const content = await readFile(joinPath(tmp, 'shopify.app.toml'))
      const expectedContent = `# Learn more about configuring your app at https://shopify.dev/docs/apps/tools/cli/configuration

name = "app1"
client_id = "api-key"
application_url = "https://example.com"
embedded = true

[access_scopes]
# Learn more at https://shopify.dev/docs/apps/tools/cli/configuration#access_scopes
use_legacy_install_flow = true

[auth]
redirect_urls = [ "https://example.com/callback1" ]

[webhooks]
api_version = "2023-07"

[pos]
embedded = false
`
      expect(content).toEqual(expectedContent)
      expect(saveCurrentConfig).toHaveBeenCalledWith({configFileName: 'shopify.app.toml', directory: tmp})
      expect(renderSuccess).toHaveBeenCalledWith({
        headline: 'shopify.app.toml is now linked to "app1" on Shopify',
        body: 'Using shopify.app.toml as your default config.',
        nextSteps: [
          [`Make updates to shopify.app.toml in your local project`],
          ['To upload your config, run', {command: 'npm run shopify app config push'}],
        ],
        reference: [
          {
            link: {
              label: 'App configuration',
              url: 'https://shopify.dev/docs/apps/tools/cli/configuration',
            },
          },
        ],
      })
    })
  })

  test('creates a new shopify.app.staging.toml file when shopify.app.toml already linked', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const options: LinkOptions = {
        directory: tmp,
        commandConfig: {runHook: vi.fn(() => Promise.resolve({successes: []}))} as unknown as Config,
      }
      const localApp = testApp({
        configuration: {
          path: 'shopify.app.development.toml',
          name: 'my app',
          client_id: '12345',
          scopes: 'write_products',
          webhooks: {api_version: '2023-04'},
          application_url: 'https://myapp.com',
          embedded: true,
          build: {
            automatically_update_urls_on_dev: true,
            dev_store_url: 'my-store.myshopify.com',
          },
        },
      })
      vi.mocked(loadApp).mockResolvedValue({...localApp, directory: tmp})
      vi.mocked(fetchOrCreateOrganizationApp).mockResolvedValue(
        testOrganizationApp({
          apiKey: '12345',
          applicationUrl: 'https://myapp.com',
          title: 'my app',
          requestedAccessScopes: ['write_products'],
        }),
      )
      vi.mocked(selectConfigName).mockResolvedValue('staging')

      // When
      await link(options)

      // Then
      const content = await readFile(joinPath(tmp, 'shopify.app.staging.toml'))
      const expectedContent = `# Learn more about configuring your app at https://shopify.dev/docs/apps/tools/cli/configuration

name = "my app"
client_id = "12345"
application_url = "https://myapp.com"
embedded = true

[access_scopes]
# Learn more at https://shopify.dev/docs/apps/tools/cli/configuration#access_scopes
scopes = "write_products"

[auth]
redirect_urls = [ "https://example.com/callback1" ]

[webhooks]
api_version = "2023-07"

[pos]
embedded = false
`
      expect(content).toEqual(expectedContent)
      expect(saveCurrentConfig).toHaveBeenCalledWith({configFileName: 'shopify.app.staging.toml', directory: tmp})
      expect(renderSuccess).toHaveBeenCalledWith({
        headline: 'shopify.app.staging.toml is now linked to "my app" on Shopify',
        body: 'Using shopify.app.staging.toml as your default config.',
        nextSteps: [
          [`Make updates to shopify.app.staging.toml in your local project`],
          ['To upload your config, run', {command: 'yarn shopify app config push'}],
        ],
        reference: [
          {
            link: {
              label: 'App configuration',
              url: 'https://shopify.dev/docs/apps/tools/cli/configuration',
            },
          },
        ],
      })
    })
  })

  test('updates the shopify.app.toml when it already exists and is unlinked', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const filePath = joinPath(tmp, 'shopify.app.toml')
      const initialContent = `scopes = ""
      `
      writeFileSync(filePath, initialContent)
      const options: LinkOptions = {
        directory: tmp,
        commandConfig: {runHook: vi.fn(() => Promise.resolve({successes: []}))} as unknown as Config,
      }
      vi.mocked(loadApp).mockResolvedValue({...LOCAL_APP, directory: tmp})
      vi.mocked(fetchOrCreateOrganizationApp).mockResolvedValue(REMOTE_APP)

      // When
      await link(options)

      // Then
      const content = await readFile(joinPath(tmp, 'shopify.app.toml'))
      const expectedContent = `# Learn more about configuring your app at https://shopify.dev/docs/apps/tools/cli/configuration

name = "app1"
client_id = "api-key"
application_url = "https://example.com"
embedded = true

[access_scopes]
# Learn more at https://shopify.dev/docs/apps/tools/cli/configuration#access_scopes
use_legacy_install_flow = true

[auth]
redirect_urls = [ "https://example.com/callback1" ]

[webhooks]
api_version = "2023-07"

[pos]
embedded = false
`
      expect(content).toEqual(expectedContent)
      expect(renderSuccess).toHaveBeenCalledWith({
        headline: 'shopify.app.toml is now linked to "app1" on Shopify',
        body: 'Using shopify.app.toml as your default config.',
        nextSteps: [
          [`Make updates to shopify.app.toml in your local project`],
          ['To upload your config, run', {command: 'yarn shopify app config push'}],
        ],
        reference: [
          {
            link: {
              label: 'App configuration',
              url: 'https://shopify.dev/docs/apps/tools/cli/configuration',
            },
          },
        ],
      })
    })
  })

  test('does not render success banner if shouldRenderSuccess is false', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const filePath = joinPath(tmp, 'shopify.app.toml')
      const initialContent = `scopes = ""
      `
      writeFileSync(filePath, initialContent)
      const options: LinkOptions = {
        directory: tmp,
        commandConfig: {runHook: vi.fn(() => Promise.resolve({successes: []}))} as unknown as Config,
      }
      vi.mocked(loadApp).mockResolvedValue({...LOCAL_APP, directory: tmp})
      vi.mocked(fetchOrCreateOrganizationApp).mockResolvedValue(REMOTE_APP)

      // When
      await link(options, false)

      // Then
      const content = await readFile(joinPath(tmp, 'shopify.app.toml'))
      const expectedContent = `# Learn more about configuring your app at https://shopify.dev/docs/apps/tools/cli/configuration

name = "app1"
client_id = "api-key"
application_url = "https://example.com"
embedded = true

[access_scopes]
# Learn more at https://shopify.dev/docs/apps/tools/cli/configuration#access_scopes
use_legacy_install_flow = true

[auth]
redirect_urls = [ "https://example.com/callback1" ]

[webhooks]
api_version = "2023-07"

[pos]
embedded = false
`
      expect(content).toEqual(expectedContent)
      expect(renderSuccess).not.toHaveBeenCalled()
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
      vi.mocked(loadApp).mockResolvedValue({...LOCAL_APP, directory: tmp})
      vi.mocked(fetchPartnersSession).mockResolvedValue(testPartnersUserSession)
      vi.mocked(fetchAppDetailsFromApiKey).mockResolvedValue(REMOTE_APP)
      vi.mocked(selectConfigName).mockResolvedValue('staging')

      // When
      await link(options)

      // Then
      expect(fetchAppDetailsFromApiKey).toHaveBeenCalledWith('api-key', 'token')
    })
  })

  test('throws an error when an invalid api key is is provided', async () => {
    vi.mocked(InvalidApiKeyErrorMessage).mockReturnValue({
      message: outputContent`Invalid Client ID`,
      tryMessage: outputContent`You can find the Client ID in the app settings in the Partners Dashboard.`,
    })

    await inTemporaryDirectory(async (tmp) => {
      // Given
      const options: LinkOptions = {
        directory: tmp,
        commandConfig: {runHook: vi.fn(() => Promise.resolve({successes: []}))} as unknown as Config,
        apiKey: '1234-5678',
      }
      vi.mocked(loadApp).mockResolvedValue({...LOCAL_APP, directory: tmp})
      vi.mocked(fetchPartnersSession).mockResolvedValue(testPartnersUserSession)
      vi.mocked(fetchAppDetailsFromApiKey).mockResolvedValue(undefined)
      vi.mocked(selectConfigName).mockResolvedValue('staging')

      // When
      const result = link(options)

      // Then
      await expect(result).rejects.toThrow(/Invalid Client ID/)
    })
  })

  test('skips config name question if re-linking to existing current app schema', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const options: LinkOptions = {
        directory: tmp,
        commandConfig: {runHook: vi.fn(() => Promise.resolve({successes: []}))} as unknown as Config,
      }
      const localApp = testApp({
        configuration: {
          path: 'shopify.app.foo.toml',
          name: 'my app',
          client_id: '12345',
          scopes: 'write_products',
          webhooks: {api_version: '2023-04'},
          application_url: 'https://myapp.com',
          embedded: true,
        },
      })
      vi.mocked(loadApp).mockResolvedValue({...localApp, directory: tmp})
      vi.mocked(fetchOrCreateOrganizationApp).mockResolvedValue(
        testOrganizationApp({
          apiKey: '12345',
          applicationUrl: 'https://myapp.com',
          title: 'my app',
          requestedAccessScopes: ['write_products'],
        }),
      )
      vi.mocked(getCachedCommandInfo).mockReturnValue({askConfigName: false, selectedToml: 'shopify.app.foo.toml'})

      // When
      await link(options)

      expect(selectConfigName).not.toHaveBeenCalled()
      expect(saveCurrentConfig).toHaveBeenCalledWith({configFileName: 'shopify.app.foo.toml', directory: tmp})
    })
  })

  test('generates the file when there is no shopify.app.toml', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const options: LinkOptions = {
        directory: tmp,
        commandConfig: {runHook: vi.fn(() => Promise.resolve({successes: []}))} as unknown as Config,
      }
      vi.mocked(loadApp).mockRejectedValue(new Error('Shopify.app.toml not found'))
      vi.mocked(fetchOrCreateOrganizationApp).mockResolvedValue(REMOTE_APP)

      // When
      await link(options)

      // Then
      const content = await readFile(joinPath(tmp, 'shopify.app.toml'))
      const expectedContent = `# Learn more about configuring your app at https://shopify.dev/docs/apps/tools/cli/configuration

name = "app1"
client_id = "api-key"
application_url = "https://example.com"
embedded = true

[access_scopes]
# Learn more at https://shopify.dev/docs/apps/tools/cli/configuration#access_scopes
use_legacy_install_flow = true

[auth]
redirect_urls = [ "https://example.com/callback1" ]

[webhooks]
api_version = "2023-07"

[pos]
embedded = false
`
      expect(content).toEqual(expectedContent)
    })
  })

  test('uses scopes on platform if defined', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const options: LinkOptions = {
        directory: tmp,
        commandConfig: {runHook: vi.fn(() => Promise.resolve({successes: []}))} as unknown as Config,
      }
      vi.mocked(loadApp).mockResolvedValue({...LOCAL_APP, directory: tmp})
      vi.mocked(fetchOrCreateOrganizationApp).mockResolvedValue({
        ...REMOTE_APP,
        requestedAccessScopes: ['read_products', 'write_orders'],
      })

      // When
      await link(options)

      // Then
      const content = await readFile(joinPath(tmp, 'shopify.app.toml'))
      const expectedContent = `# Learn more about configuring your app at https://shopify.dev/docs/apps/tools/cli/configuration

name = "app1"
client_id = "api-key"
application_url = "https://example.com"
embedded = true

[access_scopes]
# Learn more at https://shopify.dev/docs/apps/tools/cli/configuration#access_scopes
scopes = "read_products,write_orders"

[auth]
redirect_urls = [ "https://example.com/callback1" ]

[webhooks]
api_version = "2023-07"

[pos]
embedded = false
`
      expect(content).toEqual(expectedContent)
    })
  })

  test('unset privacy compliance urls are undefined', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const options: LinkOptions = {
        directory: tmp,
        commandConfig: {runHook: vi.fn(() => Promise.resolve({successes: []}))} as unknown as Config,
      }
      vi.mocked(loadApp).mockRejectedValue('App not found')
      vi.mocked(fetchOrCreateOrganizationApp).mockResolvedValue({
        ...REMOTE_APP,
        gdprWebhooks: {customerDataRequestUrl: 'https://example.com/customer-data'},
      })

      // When
      await link(options)

      // Then
      const content = await readFile(joinPath(tmp, 'shopify.app.toml'))
      const expectedContent = `# Learn more about configuring your app at https://shopify.dev/docs/apps/tools/cli/configuration

name = "app1"
client_id = "api-key"
application_url = "https://example.com"
embedded = true

[access_scopes]
# Learn more at https://shopify.dev/docs/apps/tools/cli/configuration#access_scopes
use_legacy_install_flow = true

[auth]
redirect_urls = [ "https://example.com/callback1" ]

[webhooks]
api_version = "2023-07"

  [webhooks.privacy_compliance]
  customer_data_request_url = "https://example.com/customer-data"

[pos]
embedded = false
`
      expect(content).toEqual(expectedContent)
      expect(saveCurrentConfig).toHaveBeenCalledWith({configFileName: 'shopify.app.toml', directory: tmp})
      expect(renderSuccess).toHaveBeenCalledWith({
        headline: 'shopify.app.toml is now linked to "app1" on Shopify',
        body: 'Using shopify.app.toml as your default config.',
        nextSteps: [
          [`Make updates to shopify.app.toml in your local project`],
          ['To upload your config, run', {command: 'npm run shopify app config push'}],
        ],
        reference: [
          {
            link: {
              label: 'App configuration',
              url: 'https://shopify.dev/docs/apps/tools/cli/configuration',
            },
          },
        ],
      })
    })
  })
})
