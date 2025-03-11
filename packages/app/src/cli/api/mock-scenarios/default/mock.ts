import * as BusinessPlatformDestinations from '../../graphql/business-platform-destinations/generated/mocks.js'
import * as Partners from '../../graphql/partners/generated/mocks.js'
import * as AppManagement from '../../graphql/app-management/generated/mocks.js'
import {HttpResponse, http} from 'msw'
import {btoa} from 'node:buffer'

const mocks = {
  ...BusinessPlatformDestinations,
  ...Partners,
  ...AppManagement,
}

export const handlers = [
  http.post('https://identity.shopify-cli.mock/oauth/device_authorization', () => {
    return HttpResponse.json({
      verification_uri: 'https://identity.shopify-cli.mock/activate',
      verification_uri_complete: 'https://identity.shopify-cli.mock/activate-with-code?device_code%5BABCD-EFGH',
      expires_in: 599,
      interval: 5,
      device_code: '8e049f63-fe62-4847-a8c1-4c4cc7b99bd8',
      user_code: 'ABCD-EFGH',
    })
  }),
  http.post('https://identity.shopify-cli.mock/oauth/token', () => {
    return HttpResponse.json({
      access_token: 'atkn_access-token',
      refresh_token: 'atkn_refresh-token',
      token_type: 'bearer',
      expires_in: 7200,
      scope:
        'openid https://api.shopify.com/auth/shop.admin.graphql https://api.shopify.com/auth/partners.app.cli.access https://api.shopify.com/auth/destinations.readonly https://api.shopify.com/auth/partners.collaborator-relationships.readonly https://api.shopify.com/auth/shop.storefront-renderer.devtools https://api.shopify.com/auth/shop.admin.themes https://api.shopify.com/auth/organization.store-management https://api.shopify.com/auth/organization.apps.manage',
      id_token:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTc0MTc5NDEwOH0.wUC11_60bh4d2B5IM4euDOqZ-LmVx5k5lO8Neu1hrzc',
    })
  }),
  mocks.mockListOrganizationsQueryBusinessPlatformDestinations(() => {
    return HttpResponse.json({
      data: {
        currentUserAccount: {
          uuid: '123',
          organizations: {
            nodes: [
              {
                id: btoa('gid://organization/Organization/1234'),
                name: 'Test Organization',
              },
            ],
          },
        },
      },
    })
  }),
  mocks.mockFindOrganizationsQueryBusinessPlatformDestinations(() => {
    return HttpResponse.json({
      data: {
        currentUserAccount: {
          organization: {
            id: btoa('gid://organization/Organization/1234'),
            name: 'Test Organization',
          },
        },
      },
    })
  }),
  mocks.mockAllOrgsQueryPartners(() => {
    return HttpResponse.json({
      data: {
        organizations: {
          nodes: [],
        },
      },
    })
  }),
  mocks.mockListAppsQueryAppManagement(() => {
    return HttpResponse.json({
      data: {
        appsConnection: {
          edges: [],
          pageInfo: {
            hasNextPage: false,
          },
        },
      },
    })
  }),
]
