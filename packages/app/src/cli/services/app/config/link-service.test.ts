import link from './link.js'
import {testOrganizationApp, testDeveloperPlatformClient} from '../../../models/app/app.test-data.js'
import {DeveloperPlatformClient, selectDeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {AppApiKeyAndOrgId, OrganizationApp, OrganizationSource} from '../../../models/organization.js'
import {appNamePrompt, createAsNewAppPrompt, selectOrganizationPrompt} from '../../../prompts/dev.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {inTemporaryDirectory, readFile, writeFileSync} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

vi.mock('./use.js')
vi.mock('../../../prompts/dev.js')
vi.mock('../../local-storage')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('../../dev/fetch.js')
vi.mock('../../../utilities/developer-platform-client.js')
vi.mock('../../../models/app/validation/multi-cli-warning.js')
beforeEach(async () => {})

function buildDeveloperPlatformClient(): DeveloperPlatformClient {
  return testDeveloperPlatformClient({
    supportsDevSessions: true,
    async appFromIdentifiers({apiKey}: AppApiKeyAndOrgId): Promise<OrganizationApp | undefined> {
      switch (apiKey) {
        case 'api-key':
          return testOrganizationApp({developerPlatformClient: this as DeveloperPlatformClient})
        default:
          return undefined
      }
    },
    async orgAndApps(orgId) {
      return {
        organization: {id: orgId, businessName: 'test', source: OrganizationSource.BusinessPlatform},
        apps: [mockRemoteApp()],
        hasMorePages: false,
      }
    },
    async createApp(org, options) {
      return testOrganizationApp({
        requestedAccessScopes: options?.scopesArray,
        developerPlatformClient: this as DeveloperPlatformClient,
        newApp: true,
      })
    },
  })
}

function mockRemoteApp(extraRemoteAppFields: Partial<OrganizationApp> = {}) {
  const remoteApp = testOrganizationApp()
  remoteApp.apiKey = '12345'
  return {...remoteApp, ...extraRemoteAppFields}
}

describe('link, with minimal mocking', () => {
  test('load from a fresh template, return a connected app', async () => {
    await inTemporaryDirectory(async (tmp) => {
      const initialContent = `
        scopes='write_something_unusual'
        `
      const filePath = joinPath(tmp, 'shopify.app.toml')
      writeFileSync(filePath, initialContent)
      writeFileSync(joinPath(tmp, 'package.json'), '{}')

      const developerPlatformClient = buildDeveloperPlatformClient()
      vi.mocked(selectDeveloperPlatformClient).mockReturnValue(developerPlatformClient)
      vi.mocked(createAsNewAppPrompt).mockResolvedValue(true)
      vi.mocked(appNamePrompt).mockResolvedValue('A user provided name')
      vi.mocked(selectOrganizationPrompt).mockResolvedValue({
        id: '12345',
        businessName: 'test',
        source: OrganizationSource.BusinessPlatform,
      })

      const options = {
        directory: tmp,
        developerPlatformClient,
      }
      const {configuration} = await link(options)
      const content = await readFile(joinPath(tmp, 'shopify.app.toml'))

      const expectedContent = `# Learn more about configuring your app at https://shopify.dev/docs/apps/tools/cli/configuration

client_id = "api-key"
name = "app1"
application_url = ""
embedded = true

[build]
automatically_update_urls_on_dev = true
include_config_on_deploy = true

[access_scopes]
# Learn more at https://shopify.dev/docs/apps/tools/cli/configuration#access_scopes
scopes = "write_something_unusual"

[auth]
redirect_urls = [ ]

[webhooks]
api_version = "2023-07"

[pos]
embedded = false
`
      expect(configuration).toEqual({
        client_id: 'api-key',
        name: 'app1',
        application_url: '',
        embedded: true,
        access_scopes: {
          scopes: 'write_something_unusual',
        },
        build: {
          automatically_update_urls_on_dev: true,
          include_config_on_deploy: true,
        },
        auth: {
          redirect_urls: [],
        },
        webhooks: {
          api_version: '2023-07',
        },
        pos: {
          embedded: false,
        },
        path: expect.stringMatching(/\/shopify.app.toml$/),
      })
      expect(content).toEqual(expectedContent)
    })
  })
})
