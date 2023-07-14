import {InfoOptions, info} from './info.js'
import {fetchAppFromApiKey, fetchOrgAndApps, fetchOrganizations} from './dev/fetch.js'
import {getCachedAppInfo} from './local-storage.js'
import {fetchAppFromConfigOrSelect} from './app/fetch-app-from-config-or-select.js'
import {AppInterface} from '../models/app/app.js'
import {selectOrganizationPrompt} from '../prompts/dev.js'
import {testApp, testOrganizationApp, testUIExtension} from '../models/app/app.test-data.js'
import {AppErrors} from '../models/app/loader.js'
import {describe, expect, vi, test} from 'vitest'
import {checkForNewVersion} from '@shopify/cli-kit/node/node-package-manager'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {joinPath} from '@shopify/cli-kit/node/path'
import {stringifyMessage, unstyled} from '@shopify/cli-kit/node/output'
import {inTemporaryDirectory, writeFileSync} from '@shopify/cli-kit/node/fs'

vi.mock('./local-storage.js')
vi.mock('./dev/fetch.js')
vi.mock('./app/fetch-app-from-config-or-select.js')
vi.mock('../prompts/dev.js')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/node-package-manager')

const infoOptions: InfoOptions = {
  format: 'text',
  webEnv: false,
}

describe('info', () => {
  test('returns update shopify cli reminder when last version is greater than current version', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const latestVersion = '2.2.3'
      const app = mockApp({directory: tmp})
      vi.mocked(checkForNewVersion).mockResolvedValue(latestVersion)

      // When
      const result = stringifyMessage(await info(app, infoOptions))
      // Then
      expect(unstyled(result)).toMatch('Shopify CLI       2.2.2 💡 Version 2.2.3 available! Run yarn shopify upgrade')
    })
  })

  test('returns the current config when present', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const testConfig = `
      name = "my app"
      api_contact_email = "me@example.com"
      client_id = "12345"
      application_url = "https://example.com/lala"
      embedded = true

      [webhooks]
      api_version = "2023-07"
      `
      vi.mocked(getCachedAppInfo).mockReturnValue(undefined)
      vi.mocked(fetchAppFromApiKey).mockResolvedValue(
        testOrganizationApp({id: '123', title: 'my app', apiKey: '12345'}),
      )

      const app = mockApp({
        directory: tmp,
        app: testApp({
          name: 'my app',
          directory: tmp,
          configurationPath: joinPath(tmp, 'shopify.app.toml'),
          configuration: {
            name: 'my app',
            api_contact_email: 'me@example.com',
            client_id: '12345',
            application_url: 'https://example.com/lala',
            embedded: true,
            webhooks: {api_version: '2023-07'},
            access_scopes: {scopes: 'read_products'},
          },
        }),
        configContents: testConfig,
      })

      // When
      const result = stringifyMessage(await info(app, infoOptions))

      // Then
      expect(unstyled(result)).toMatch(/Configuration file\s*shopify.app.toml/)
      expect(unstyled(result)).toMatch(/App name\s*my app/)
      expect(unstyled(result)).toMatch(/Client ID\s*12345/)
      expect(unstyled(result)).toMatch(/Access scopes\s*read_products/)
      expect(unstyled(result)).toMatch(/Dev store\s*Not yet configured/)
      expect(unstyled(result)).toMatch(/Update URLs\s*Not yet configured/)
    })
  })

  test('returns the current cache from dev when present', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const cachedAppInfo = {
        directory: '/path',
        title: 'My App',
        appId: '123',
        storeFqdn: 'my-app.example.com',
        updateURLs: true,
      }
      vi.mocked(getCachedAppInfo).mockReturnValue(cachedAppInfo)
      const app = mockApp({directory: tmp})

      // When
      const result = stringifyMessage(await info(app, infoOptions))

      // Then
      expect(unstyled(result)).toMatch(/Configuration file\s*shopify.app.toml/)
      expect(unstyled(result)).toMatch(/App name\s*My App/)
      expect(unstyled(result)).toMatch(/Client ID\s*123/)
      expect(unstyled(result)).toMatch(/Access scopes\s*my-scope/)
      expect(unstyled(result)).toMatch(/Dev store\s*my-app.example.com/)
      expect(unstyled(result)).toMatch(/Update URLs\s*Always/)
    })
  })

  test('returns empty configs for dev when not present', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const app = mockApp({directory: tmp})

      // When
      const result = stringifyMessage(await info(app, infoOptions))

      // Then
      expect(unstyled(result)).toMatch(/App name\s*Not yet configured/)
      expect(unstyled(result)).toMatch(/Dev store\s*Not yet configured/)
      expect(unstyled(result)).toMatch(/Client ID\s*Not yet configured/)
      expect(unstyled(result)).toMatch(/Update URLs\s*Not yet configured/)
    })
  })

  test('returns update shopify cli reminder when last version lower or equals to current version', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const app = mockApp({directory: tmp})
      vi.mocked(checkForNewVersion).mockResolvedValue(undefined)

      // When
      const result = stringifyMessage(await info(app, infoOptions))
      // Then
      expect(unstyled(result)).toMatch('Shopify CLI       2.2.2')
      expect(unstyled(result)).not.toMatch('CLI reminder')
    })
  })

  test('returns the web environment as a text when webEnv is true', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const app = mockApp({directory: tmp})
      const organization = {
        id: '123',
        betas: {},
        businessName: 'test',
        website: '',
        apps: {nodes: []},
      }
      const organizationApp = testOrganizationApp({
        id: '123',
        title: 'Test app',
        appType: 'custom',
      })

      vi.mocked(fetchOrganizations).mockResolvedValue([organization])
      vi.mocked(selectOrganizationPrompt).mockResolvedValue(organization)
      vi.mocked(fetchOrgAndApps).mockResolvedValue({
        organization,
        stores: [],
        apps: {
          nodes: [organizationApp],
          pageInfo: {hasNextPage: false},
        },
      })
      vi.mocked(fetchAppFromConfigOrSelect).mockResolvedValue(organizationApp)
      vi.mocked(ensureAuthenticatedPartners).mockResolvedValue('token')

      // When
      const result = await info(app, {...infoOptions, webEnv: true})

      // Then
      expect(unstyled(stringifyMessage(result))).toMatchInlineSnapshot(`
      "
          SHOPIFY_API_KEY=api-key
          SHOPIFY_API_SECRET=api-secret
          SCOPES=my-scope
        "
      `)
    })
  })

  test('returns the web environment as a json when webEnv is true', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const app = mockApp({directory: tmp})
      const organization = {
        id: '123',
        betas: {},
        businessName: 'test',
        website: '',
        apps: {nodes: []},
      }
      const organizationApp = testOrganizationApp({
        id: '123',
        title: 'Test app',
        appType: 'custom',
      })
      vi.mocked(fetchOrganizations).mockResolvedValue([organization])
      vi.mocked(selectOrganizationPrompt).mockResolvedValue(organization)
      vi.mocked(fetchOrgAndApps).mockResolvedValue({
        organization,
        stores: [],
        apps: {
          nodes: [organizationApp],
          pageInfo: {hasNextPage: false},
        },
      })
      vi.mocked(fetchAppFromConfigOrSelect).mockResolvedValue(organizationApp)
      vi.mocked(ensureAuthenticatedPartners).mockResolvedValue('token')

      // When
      const result = await info(app, {...infoOptions, format: 'json', webEnv: true})

      // Then
      expect(unstyled(stringifyMessage(result))).toMatchInlineSnapshot(`
        "{
          \\"SHOPIFY_API_KEY\\": \\"api-key\\",
          \\"SHOPIFY_API_SECRET\\": \\"api-secret\\",
          \\"SCOPES\\": \\"my-scope\\"
        }"
      `)
    })
  })

  test('returns errors alongside extensions when extensions have errors', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const uiExtension1 = await testUIExtension({
        configuration: {
          name: 'Extension 1',
          type: 'ui_extension',
          metafields: [],
        },
        configurationPath: 'extension/path/1',
      })
      const uiExtension2 = await testUIExtension({
        configuration: {
          name: 'Extension 2',
          type: 'checkout_ui_extension',
          metafields: [],
        },
        configurationPath: 'extension/path/2',
      })

      const errors = new AppErrors()
      errors.addError(uiExtension1.configurationPath, 'Mock error with ui_extension')
      errors.addError(uiExtension2.configurationPath, 'Mock error with checkout_ui_extension')

      const app = mockApp({
        directory: tmp,
        app: {
          errors,
          allExtensions: [uiExtension1, uiExtension2],
        },
      })
      const organization = {
        id: '123',
        betas: {},
        businessName: 'test',
        website: '',
        apps: {nodes: []},
      }
      const organizationApp = testOrganizationApp({
        id: '123',
        title: 'Test app',
        appType: 'custom',
      })
      vi.mocked(fetchOrganizations).mockResolvedValue([organization])
      vi.mocked(selectOrganizationPrompt).mockResolvedValue(organization)
      vi.mocked(fetchOrgAndApps).mockResolvedValue({
        organization,
        stores: [],
        apps: {
          nodes: [organizationApp],
          pageInfo: {hasNextPage: false},
        },
      })
      vi.mocked(fetchAppFromConfigOrSelect).mockResolvedValue(organizationApp)
      vi.mocked(ensureAuthenticatedPartners).mockResolvedValue('token')

      // When
      const result = await info(app, infoOptions)

      // Then
      expect(result).toContain('Extensions with errors')
      expect(result).toContain('📂 ui_extension')
      expect(result).toContain('! Mock error with ui_extension')
      expect(result).toContain('! Mock error with checkout_ui_extension')
    })
  })
})

function mockApp({
  directory,
  currentVersion = '2.2.2',
  configContents = 'scopes = "read_products"',
  app,
}: {
  directory: string
  currentVersion?: string
  configContents?: string
  app?: Partial<AppInterface>
}): AppInterface {
  const nodeDependencies: {[key: string]: string} = {}
  nodeDependencies['@shopify/cli'] = currentVersion

  writeFileSync(joinPath(directory, 'shopify.app.toml'), configContents)

  return testApp({
    name: 'my app',
    directory,
    configurationPath: joinPath(directory, 'shopify.app.toml'),
    configuration: {
      scopes: 'my-scope',
      extension_directories: ['extensions/*'],
    },
    nodeDependencies,
    ...(app ? app : {}),
  })
}
