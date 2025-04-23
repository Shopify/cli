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
import {NoOrgError} from '../../services/dev/fetch.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {ClientError} from 'graphql-request'
import {describe, expect, vi, test, beforeEach, Mock, afterEach} from 'vitest'

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
    expect(partnersRequest).toHaveBeenCalledWith(CreateAppQuery, 'token', variables, undefined, expect.any(Function))
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
    expect(partnersRequest).toHaveBeenCalledWith(CreateAppQuery, 'token', variables, undefined, expect.any(Function))
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
    expect(partnersRequest).toHaveBeenCalledWith(
      FindOrganizationQuery,
      'token',
      {id: ORG1.id},
      undefined,
      expect.any(Function),
    )
  })

  test('throws if there are no organizations', async () => {
    // Given
    const partnersClient = new PartnersClient(testPartnersUserSession)
    vi.mocked(partnersRequest).mockResolvedValue({organizations: {nodes: []}})

    // When
    const got = () => partnersClient.orgAndApps(ORG1.id)

    // Then
    await expect(got).rejects.toThrowError(new NoOrgError(testPartnersUserSession.accountInfo))
    expect(partnersRequest).toHaveBeenCalledWith(
      FindOrganizationQuery,
      'token',
      {id: ORG1.id},
      undefined,
      expect.any(Function),
    )
  })
})

describe('Request authorization and token refresh', () => {
  let partnersClient: PartnersClient
  let sessionMock: typeof testPartnersUserSession
  const partnersRequestMock = vi.mocked(partnersRequest)

  beforeEach(() => {
    sessionMock = testPartnersUserSession
    partnersClient = new PartnersClient(sessionMock)
    vi.spyOn(partnersClient, 'refreshToken').mockImplementation(vi.fn())
    partnersRequestMock.mockClear()
    ;(partnersClient.refreshToken as Mock).mockClear()
  })

  afterEach(() => {
    // Clear mocks if necessary, though Vitest often handles this
  })

  describe('partnersRequest integration', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    const query = `query { shop { name } }`
    const variables = {shopId: '123'}
    // Error representing an unauthorized (401) response
    const unauthorizedError = new ClientError({status: 401, headers: {}}, {query, variables})

    test('throws error if refresh token fails', async () => {
      // Given
      const refreshError = new Error('Token refresh failed')
      ;(partnersClient.refreshToken as Mock).mockRejectedValue(refreshError)

      partnersRequestMock.mockImplementationOnce(async (_query, _token, _variables, _headers, handler) => {
        if (handler) {
          await handler()
        }
        throw unauthorizedError
      })

      // When / Then
      await expect(partnersClient.request(query, variables)).rejects.toThrow(refreshError)
      expect(partnersClient.refreshToken).toHaveBeenCalledOnce()
      expect(partnersRequestMock).toHaveBeenCalledTimes(1)
    })

    test('throws other errors immediately without attempting refresh', async () => {
      // Given
      const otherError = new ClientError({status: 500, headers: {}}, {query, variables})
      partnersRequestMock.mockRejectedValueOnce(otherError)

      // When / Then
      await expect(partnersClient.request(query, variables)).rejects.toThrow(otherError)
      expect(partnersClient.refreshToken).not.toHaveBeenCalled()
      expect(partnersRequestMock).toHaveBeenCalledTimes(1)
    })

    test('throws original 401 if retry also fails after successful refresh', async () => {
      // Given
      // Mock refreshToken to succeed and spy on it
      const refreshTokenSpy = vi.spyOn(partnersClient, 'refreshToken').mockResolvedValue('new-token')

      // Mock partnersRequest to throw 401 twice, ensuring handler is called first time
      partnersRequestMock.mockImplementationOnce(async (_query, _token, _variables, _headers, handler) => {
        // Simulate the first 401, triggering the handler
        if (handler) {
          // Explicitly await the handler which calls refreshToken
          await handler()
          // Ensure refreshToken was called before throwing
          expect(refreshTokenSpy).toHaveBeenCalled()
        }
        // Then throw the error AFTER handler completes
        throw unauthorizedError
      })

      // When / Then
      // Explicitly await the request call
      await expect(partnersClient.request(query, variables)).rejects.toThrow(unauthorizedError)

      // Verify refresh was attempted
      expect(refreshTokenSpy).toHaveBeenCalledOnce()

      // Verify the request was made, and handled refr
      expect(partnersRequestMock).toHaveBeenCalledTimes(1)
    })
  })
})
