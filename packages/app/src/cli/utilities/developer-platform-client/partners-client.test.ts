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
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {describe, expect, vi, test} from 'vitest'

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
})
