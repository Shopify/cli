import {PartnersClient} from './partners-client.js'
import {CreateAppQuery} from '../../api/graphql/create_app.js'
import {AppInterface, WebType} from '../../models/app/app.js'
import {Organization, OrganizationSource, OrganizationStore} from '../../models/organization.js'
import {
  testPartnersUserSession,
  testApp,
  testAppWithLegacyConfig,
  testOrganizationApp,
} from '../../models/app/app.test-data.js'
import {appNamePrompt} from '../../prompts/dev.js'
import {FindOrganizationQuery} from '../../api/graphql/find_org.js'
import {ExtensionTemplate} from '../../models/app/template.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {writeFile, removeFile} from '@shopify/cli-kit/node/fs'
import {joinPath, cwd} from '@shopify/cli-kit/node/path'
import {describe, expect, vi, test, beforeEach, afterEach} from 'vitest'

vi.mock('../../prompts/dev.js')
vi.mock('@shopify/cli-kit/node/api/partners')

const LOCAL_APP: AppInterface = testApp({
  directory: '',
  configuration: {path: '/shopify.app.toml', scopes: 'read_products', extension_directories: ['extensions/*']},
  webs: [
    {
      directory: '',
      configuration: {
        roles: [WebType.Backend],
        commands: {dev: ''},
      },
    },
  ],
  name: 'my-app',
})

type OrganizationInPartnersResponse = Omit<Organization, 'source'>

const ORG1: OrganizationInPartnersResponse = {
  id: '1',
  businessName: 'org1',
}
const ORG2: OrganizationInPartnersResponse = {
  id: '2',
  businessName: 'org2',
}

const APP1 = testOrganizationApp({apiKey: 'key1'})
const APP2 = testOrganizationApp({
  id: '2',
  title: 'app2',
  apiKey: 'key2',
  apiSecretKeys: [{secret: 'secret2'}],
})

const STORE1: OrganizationStore = {
  shopId: '1',
  link: 'link1',
  shopDomain: 'domain1',
  shopName: 'store1',
  transferDisabled: false,
  convertableToPartnerTest: false,
  provisionable: true,
}

const FETCH_ORG_RESPONSE_VALUE = {
  organizations: {
    nodes: [
      {
        id: ORG1.id,
        businessName: ORG1.businessName,
        apps: {nodes: [APP1, APP2], pageInfo: {hasNextPage: false}},
        stores: {nodes: [STORE1]},
      },
    ],
  },
}

describe('createApp', () => {
  test('sends request to create app with launchable defaults and returns it', async () => {
    // Given
    const partnersClient = new PartnersClient(testPartnersUserSession)
    const localApp = testAppWithLegacyConfig({config: {scopes: 'write_products'}})
    vi.mocked(appNamePrompt).mockResolvedValue('app-name')
    vi.mocked(partnersRequest).mockResolvedValueOnce({appCreate: {app: APP1, userErrors: []}})
    const variables = {
      org: 1,
      title: localApp.name,
      appUrl: 'https://example.com',
      redir: ['https://example.com/api/auth'],
      requestedAccessScopes: ['write_products'],
      type: 'undecided',
    }

    // When
    const got = await partnersClient.createApp(
      {...ORG1, source: OrganizationSource.Partners},
      {
        name: localApp.name,
        scopesArray: ['write_products'],
        isLaunchable: true,
        directory: '',
      },
    )

    // Then
    expect(got).toEqual({...APP1, newApp: true, developerPlatformClient: partnersClient})
    expect(partnersRequest).toHaveBeenCalledWith(CreateAppQuery, 'token', variables, undefined, undefined, {
      type: 'token_refresh',
      handler: expect.any(Function),
    })
  })

  test('creates an app with non-launchable defaults', async () => {
    // Given
    const partnersClient = new PartnersClient(testPartnersUserSession)
    vi.mocked(appNamePrompt).mockResolvedValue('app-name')
    vi.mocked(partnersRequest).mockResolvedValueOnce({appCreate: {app: APP1, userErrors: []}})
    const variables = {
      org: 1,
      title: LOCAL_APP.name,
      appUrl: 'https://shopify.dev/apps/default-app-home',
      redir: ['https://shopify.dev/apps/default-app-home/api/auth'],
      requestedAccessScopes: ['write_products'],
      type: 'undecided',
    }

    // When
    const got = await partnersClient.createApp(
      {...ORG1, source: OrganizationSource.Partners},
      {
        name: LOCAL_APP.name,
        isLaunchable: false,
        scopesArray: ['write_products'],
      },
    )

    // Then
    expect(got).toEqual({...APP1, newApp: true, developerPlatformClient: partnersClient})
    expect(partnersRequest).toHaveBeenCalledWith(CreateAppQuery, 'token', variables, undefined, undefined, {
      type: 'token_refresh',
      handler: expect.any(Function),
    })
  })

  test('throws error if requests has a user error', async () => {
    // Given
    const partnersClient = new PartnersClient(testPartnersUserSession)
    vi.mocked(appNamePrompt).mockResolvedValue('app-name')
    vi.mocked(partnersRequest).mockResolvedValueOnce({
      appCreate: {app: {}, userErrors: [{message: 'some-error'}]},
    })

    // When
    const got = partnersClient.createApp({...ORG2, source: OrganizationSource.Partners}, {name: LOCAL_APP.name})

    // Then
    await expect(got).rejects.toThrow(`some-error`)
  })
})

describe('fetchApp', async () => {
  test('returns fetched apps', async () => {
    // Given
    const partnersClient = new PartnersClient(testPartnersUserSession)
    vi.mocked(partnersRequest).mockResolvedValue(FETCH_ORG_RESPONSE_VALUE)
    const partnerMarkedOrg = {...ORG1, source: 'Partners'}

    // When
    const got = await partnersClient.orgAndApps(ORG1.id)

    // Then
    expect(got).toEqual({organization: partnerMarkedOrg, apps: [APP1, APP2], hasMorePages: false})
    expect(partnersRequest).toHaveBeenCalledWith(FindOrganizationQuery, 'token', {id: ORG1.id}, undefined, undefined, {
      type: 'token_refresh',
      handler: expect.any(Function),
    })
  })

  test('throws if there are no organizations', async () => {
    // Given
    const partnersClient = new PartnersClient(testPartnersUserSession)
    vi.mocked(partnersRequest).mockResolvedValue({organizations: {nodes: []}})

    // When
    const got = () => partnersClient.orgAndApps(ORG1.id)

    // Then
    await expect(got).rejects.toThrow('No Organization found')
    expect(partnersRequest).toHaveBeenCalledWith(FindOrganizationQuery, 'token', {id: ORG1.id}, undefined, undefined, {
      type: 'token_refresh',
      handler: expect.any(Function),
    })
  })
})

describe('PartnersClient', () => {
  describe('bundleFormat', () => {
    test('uses zip format', () => {
      // Given
      const client = new PartnersClient()

      // Then
      expect(client.bundleFormat).toBe('zip')
    })
  })

  describe('templateSpecifications', () => {
    let originalEnv: string | undefined
    let tempFilePath: string

    beforeEach(() => {
      originalEnv = process.env.SHOPIFY_CLI_APP_TEMPLATES_JSON_PATH
      tempFilePath = joinPath(cwd(), 'test-templates.json')
    })

    afterEach(async () => {
      if (originalEnv) {
        process.env.SHOPIFY_CLI_APP_TEMPLATES_JSON_PATH = originalEnv
      } else {
        delete process.env.SHOPIFY_CLI_APP_TEMPLATES_JSON_PATH
      }

      try {
        await removeFile(tempFilePath)
      } catch (error) {
        // File might not exist, ignore only file not found errors
        if (error instanceof Error && !error.message.includes('ENOENT')) {
          throw error
        }
      }
    })

    test('uses local JSON file when SHOPIFY_CLI_APP_TEMPLATES_JSON_PATH is set', async () => {
      // Given
      const localTemplates: ExtensionTemplate[] = [
        {
          identifier: 'test_extension',
          name: 'Test Extension',
          defaultName: 'test-extension',
          group: 'Test Group',
          supportLinks: ['https://test.com'],
          type: 'ui_extension',
          extensionPoints: ['admin.test'],
          supportedFlavors: [
            {
              name: 'JavaScript React',
              value: 'react',
              path: 'test-path',
            },
          ],
          url: 'https://github.com/test/repo',
          sortPriority: 1,
        },
      ]

      await writeFile(tempFilePath, JSON.stringify(localTemplates))
      process.env.SHOPIFY_CLI_APP_TEMPLATES_JSON_PATH = tempFilePath

      const client = new PartnersClient(testPartnersUserSession)

      // When
      const result = await client.templateSpecifications({apiKey: 'test-key', organizationId: 'org-id', id: 'app-id'})

      // Then
      expect(result.templates).toHaveLength(1)
      expect(result.templates[0]).toEqual(
        expect.objectContaining({
          identifier: 'test_extension',
          name: 'Test Extension',
          group: 'Test Group',
        }),
      )
      expect(result.groupOrder).toEqual(['Test Group'])
      expect(vi.mocked(partnersRequest)).not.toHaveBeenCalled()
    })

    test('throws error when SHOPIFY_CLI_APP_TEMPLATES_JSON_PATH points to non-existent file', async () => {
      // Given
      const nonExistentPath = joinPath(cwd(), 'non-existent-templates.json')
      process.env.SHOPIFY_CLI_APP_TEMPLATES_JSON_PATH = nonExistentPath

      const client = new PartnersClient(testPartnersUserSession)

      // When & Then
      await expect(
        client.templateSpecifications({apiKey: 'test-key', organizationId: 'org-id', id: 'app-id'}),
      ).rejects.toThrow('There is no file at the path specified for template specifications')
    })

    test('falls back to GraphQL when SHOPIFY_CLI_APP_TEMPLATES_JSON_PATH not set', async () => {
      // Given
      delete process.env.SHOPIFY_CLI_APP_TEMPLATES_JSON_PATH

      const mockGraphQLResponse = {
        templateSpecifications: [
          {
            identifier: 'graphql_extension',
            name: 'GraphQL Extension',
            defaultName: 'graphql-extension',
            group: 'GraphQL Group',
            sortPriority: 5,
            supportLinks: ['https://graphql.com'],
            types: [
              {
                url: 'https://github.com/graphql/repo',
                type: 'ui_extension',
                extensionPoints: ['admin.graphql'],
                supportedFlavors: [
                  {
                    name: 'TypeScript',
                    value: 'typescript',
                    path: 'graphql-path',
                  },
                ],
              },
            ],
          },
        ],
      }

      vi.mocked(partnersRequest).mockResolvedValueOnce(mockGraphQLResponse)
      const client = new PartnersClient(testPartnersUserSession)

      // When
      const result = await client.templateSpecifications({apiKey: 'test-key', organizationId: 'org-id', id: 'app-id'})

      // Then
      expect(result.templates).toHaveLength(1)
      expect(result.templates[0]).toEqual(
        expect.objectContaining({
          identifier: 'graphql_extension',
          name: 'GraphQL Extension',
          group: 'GraphQL Group',
          url: 'https://github.com/graphql/repo',
        }),
      )
      expect(result.groupOrder).toEqual(['GraphQL Group'])
      expect(vi.mocked(partnersRequest)).toHaveBeenCalledTimes(1)
    })
  })
})
