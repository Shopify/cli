import {PartnersClient} from './partners-client.js'
import {CreateAppQuery} from '../../api/graphql/create_app.js'
import {RemoteTemplateSpecificationsQuery} from '../../api/graphql/template_specifications.js'
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
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, vi, test, beforeEach, afterEach} from 'vitest'

vi.mock('../../prompts/dev.js')
vi.mock('@shopify/cli-kit/node/api/partners')

beforeEach(() => {
  // Reset the singleton instance before each test
  PartnersClient.resetInstance()
})

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
    const partnersClient = PartnersClient.getInstance(testPartnersUserSession)
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
    const partnersClient = PartnersClient.getInstance(testPartnersUserSession)
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
    const partnersClient = PartnersClient.getInstance(testPartnersUserSession)
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
    const partnersClient = PartnersClient.getInstance(testPartnersUserSession)
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
    const partnersClient = PartnersClient.getInstance(testPartnersUserSession)
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
      const client = PartnersClient.getInstance()

      // Then
      expect(client.bundleFormat).toBe('zip')
    })
  })
})

describe('singleton pattern', () => {
  test('getInstance returns the same instance', () => {
    // Given/When
    const instance1 = PartnersClient.getInstance()
    const instance2 = PartnersClient.getInstance()

    // Then
    expect(instance1).toBe(instance2)
  })

  test('resetInstance allows creating a new instance', () => {
    // Given
    const instance1 = PartnersClient.getInstance()

    // When
    PartnersClient.resetInstance()
    const instance2 = PartnersClient.getInstance()

    // Then
    expect(instance1).not.toBe(instance2)
  })
})

describe('templateSpecifications', () => {
  const originalEnv = process.env

  afterEach(() => {
    process.env = originalEnv
  })

  test('fetches templates from GraphQL when no override is set', async () => {
    // Given
    const partnersClient = PartnersClient.getInstance(testPartnersUserSession)
    const mockTemplates = {
      templateSpecifications: [
        {
          identifier: 'test-template',
          name: 'Test Template',
          defaultName: 'test',
          group: 'TestGroup',
          sortPriority: 1,
          supportLinks: [],
          types: [{url: 'https://example.com', type: 'test', extensionPoints: [], supportedFlavors: []}],
        },
      ],
    }
    vi.mocked(partnersRequest).mockResolvedValueOnce(mockTemplates)

    // When
    const result = await partnersClient.templateSpecifications({apiKey: 'test-api-key'})

    // Then
    expect(partnersRequest).toHaveBeenCalledWith(
      RemoteTemplateSpecificationsQuery,
      'token',
      {apiKey: 'test-api-key'},
      undefined,
      undefined,
      {type: 'token_refresh', handler: expect.any(Function)},
    )
    expect(result.templates).toHaveLength(1)
    expect(result.templates[0]!.identifier).toBe('test-template')
  })

  test('loads templates from JSON file when SHOPIFY_CLI_APP_TEMPLATES_JSON_PATH is set', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const templatesPath = joinPath(tmpDir, 'templates.json')
      const templates = [
        {
          identifier: 'json-template',
          name: 'JSON Template',
          defaultName: 'json-test',
          group: 'JsonGroup',
          sortPriority: 1,
          supportLinks: [],
          type: 'json-type',
          url: 'https://example.com/json',
          extensionPoints: [],
          supportedFlavors: [],
        },
      ]
      await writeFile(templatesPath, JSON.stringify(templates))
      process.env = {...originalEnv, SHOPIFY_CLI_APP_TEMPLATES_JSON_PATH: templatesPath}

      const partnersClient = PartnersClient.getInstance(testPartnersUserSession)

      // When
      const result = await partnersClient.templateSpecifications({apiKey: 'test-api-key'})

      // Then
      expect(partnersRequest).not.toHaveBeenCalledWith(
        RemoteTemplateSpecificationsQuery,
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
      )
      expect(result.templates).toHaveLength(1)
      expect(result.templates[0]!.identifier).toBe('json-template')
      expect(result.templates[0]!.type).toBe('json-type')
    })
  })

  test('throws error when SHOPIFY_CLI_APP_TEMPLATES_JSON_PATH points to non-existent file', async () => {
    // Given
    process.env = {...originalEnv, SHOPIFY_CLI_APP_TEMPLATES_JSON_PATH: '/non/existent/path.json'}
    const partnersClient = PartnersClient.getInstance(testPartnersUserSession)

    // When/Then
    await expect(partnersClient.templateSpecifications({apiKey: 'test-api-key'})).rejects.toThrow(
      'There is no file at the path specified for template specifications',
    )
  })
})
