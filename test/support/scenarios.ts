import {
  appAudience,
  appManagementUrl,
  businessAudience,
  businessPlatformUrl,
  clientId,
  specification,
} from './fixture.js'
import type {CommandFixture} from './fixture.js'
import type {ResponseFixture} from './protocol.js'

export function mockUiSpecification(fixture: CommandFixture) {
  fixture.remote.specifications.push(specification('ui_extension', 'extension'))
}

export function mockLocalizedSpecification(fixture: CommandFixture) {
  fixture.remote.specifications.push(
    specification('fixture_configuration', 'configuration', {
      type: 'object',
      properties: {
        fixture_configuration: {type: 'object', properties: {enabled: {type: 'boolean'}}},
        localization: {type: 'object'},
      },
    }),
  )
}

export const tokenUrl = 'https://accounts.shopify.com/oauth/token'
export const authorizationUrl = 'https://accounts.shopify.com/oauth/device_authorization'
export const errorReportingUrl = 'https://error-analytics-production.shopifysvc.com/'
export const browserUrl = 'https://accounts.example.test/device/fixture'
export function mockErrorReport(fixture: CommandFixture) {
  fixture.mockNetwork({method: 'POST', url: errorReportingUrl, responses: [{body: {}}]})
}
function mockUserTokenExchanges(
  fixture: CommandFixture,
  tokens = {app: 'synthetic-app-token', business: 'synthetic-business-token'},
) {
  fixture.mockTokenExchange(appAudience, tokens.app)
  fixture.mockTokenExchange(businessAudience, tokens.business)
  fixture.mockTokenExchange('ee139b3d-5861-4d45-b387-1bc3ada7811c', 'synthetic-storefront-token')
  fixture.mockTokenExchange(
    '271e16d403dfa18082ffb3d197bd2b5f4479c3fc32736d69296829cbb28d41a6',
    'synthetic-partners-token',
  )
}
export function mockRefreshSession(
  fixture: CommandFixture,
  tokens = {app: 'synthetic-app-token', business: 'synthetic-business-token'},
) {
  fixture.mockNetwork({
    method: 'POST',
    url: tokenUrl,
    form: {grant_type: 'refresh_token'},
    responses: [
      {
        body: {
          access_token: 'synthetic-refreshed-identity',
          refresh_token: 'synthetic-refreshed-refresh',
          expires_in: 3600,
          scope: fixture.user.identity.scopes.join(' '),
        },
      },
    ],
  })
  mockUserTokenExchanges(fixture, tokens)
}
export async function givenFullAuthentication(fixture: CommandFixture, polls: ResponseFixture[] = []) {
  fixture.configure({
    environment: {
      CODESPACES: '1',
    },
  })
  await fixture.seedState({
    authentication: {
      serializedSessions: '',
    },
  })
  fixture.mockNetwork({
    method: 'POST',
    url: authorizationUrl,
    responses: [
      {
        body: {
          device_code: 'fixture-device',
          user_code: 'FIXTURE',
          verification_uri: browserUrl,
          verification_uri_complete: browserUrl,
          interval: 0.01,
          expires_in: 60,
        },
      },
    ],
  })
  const token = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from(
    '{"sub":"synthetic-user"}',
  ).toString('base64url')}.`
  fixture.mockNetwork({
    method: 'POST',
    url: tokenUrl,
    form: {grant_type: 'urn:ietf:params:oauth:grant-type:device_code'},
    responses: [
      ...polls,
      {
        body: {
          access_token: 'synthetic-new-identity',
          refresh_token: 'synthetic-new-refresh',
          expires_in: 3600,
          scope: fixture.user.identity.scopes.join(' '),
          id_token: token,
        },
      },
    ],
  })
  mockUserTokenExchanges(fixture)
  fixture.mockNetwork({
    method: 'POST',
    url: businessPlatformUrl,
    operation: 'UserEmail',
    responses: [{body: {data: {currentUserAccount: {email: 'login@example.test'}}}}],
  })
}
export function mockRemoteConfiguration(fixture: CommandFixture) {
  for (const [identifier, config] of [
    ['branding', {name: 'Remote fixture'}],
    ['app_home', {app_url: 'https://remote.example.test', embedded: true}],
    ['app_access', {scopes: 'read_products', redirect_url_allowlist: ['https://remote.example.test/callback']}],
  ] as const) {
    fixture.remote.app.activeRelease.version.appModules.push({
      uuid: `fixture-${identifier}`,
      userIdentifier: identifier,
      handle: identifier,
      config,
      specification: {
        identifier,
        externalIdentifier: identifier,
        name: identifier,
        experience: 'configuration',
        managementExperience: 'cli',
      },
    })
  }
  for (const operation of ['ActiveAppReleaseFromApiKey', 'fetchSpecifications']) {
    const request = fixture.networkMocks.find((entry) => entry.operation === operation)!
    request.responses.push(structuredClone(request.responses[0]!))
  }
}
export function givenInteractiveLink(
  fixture: CommandFixture,
  options: {
    create?: boolean
    organizations?: number
  } = {},
) {
  mockRemoteConfiguration(fixture)
  fixture.networkMocks.find((request) => request.operation === 'UserInfo')!.repeatLastResponse = true
  fixture.mockNetwork({
    method: 'POST',
    url: businessPlatformUrl,
    operation: 'ListOrganizations',
    responses: [
      {
        body: {
          data: {
            currentUserAccount: {
              uuid: 'synthetic-user',
              organizationsWithAccessToDestination: {
                nodes: Array.from({length: options.organizations ?? 1}, (_, index) => ({
                  id: Buffer.from(`gid://organization/Organization/${123 + index}`).toString('base64'),
                  name: `Fixture organization ${index + 1}`,
                })),
              },
            },
          },
        },
      },
    ],
  })
  fixture.mockNetwork({
    method: 'POST',
    url: appManagementUrl,
    operation: 'listApps',
    responses: [
      {
        body: {
          data: {
            appsConnection: {
              edges: options.create
                ? []
                : [{node: {id: fixture.remote.app.id, key: clientId, activeRelease: fixture.remote.app.activeRelease}}],
              pageInfo: {hasNextPage: false},
            },
          },
        },
      },
    ],
  })
  if (options.create) {
    fixture.mockNetwork({
      method: 'POST',
      url: 'https://app.shopify.com/webhooks/unstable/organizations/123/graphql.json',
      operation: 'publicApiVersions',
      responses: [
        {body: {data: {publicApiVersions: [{handle: '2025-07'}, {handle: 'unstable'}, {handle: '2025-10'}]}}},
      ],
    })
    fixture.mockNetwork({
      method: 'POST',
      url: appManagementUrl,
      operation: 'CreateApp',
      responses: [
        {
          body: {
            data: {
              appCreate: {
                app: {id: fixture.remote.app.id, key: clientId, activeRoot: fixture.remote.app.activeRoot},
                userErrors: [],
              },
            },
          },
        },
      ],
    })
  }
}
