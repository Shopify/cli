import {beforeEach, describe, expect, test, vi} from 'vitest'
import {adminUrl} from '@shopify/cli-kit/node/api/admin'
import {graphqlRequest} from '@shopify/cli-kit/node/api/graphql'
import {renderSingleTask} from '@shopify/cli-kit/node/ui'
import {clearStoredStoreAppSession} from '../auth/session-store.js'
import {prepareStoreExecuteRequest} from './request.js'
import {runAdminStoreGraphQLOperation} from './admin-transport.js'
import {STORE_AUTH_APP_CLIENT_ID} from '../auth/config.js'

vi.mock('../auth/session-store.js')
vi.mock('@shopify/cli-kit/node/api/graphql')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/api/admin', async () => {
  const actual = await vi.importActual<typeof import('@shopify/cli-kit/node/api/admin')>('@shopify/cli-kit/node/api/admin')
  return {
    ...actual,
    adminUrl: vi.fn(),
  }
})

describe('runAdminStoreGraphQLOperation', () => {
  const store = 'shop.myshopify.com'
  const context = {
    adminSession: {token: 'token', storeFqdn: store},
    version: '2025-10',
    session: {
      store,
      clientId: STORE_AUTH_APP_CLIENT_ID,
      userId: '42',
      accessToken: 'token',
      scopes: ['read_products', 'write_orders'],
      acquiredAt: '2026-03-27T00:00:00.000Z',
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(adminUrl).mockReturnValue('https://shop.myshopify.com/admin/api/2025-10/graphql.json')
    vi.mocked(renderSingleTask).mockImplementation(async ({task}) => task(() => {}))
  })

  test('executes the GraphQL request successfully', async () => {
    vi.mocked(graphqlRequest).mockResolvedValue({data: {shop: {name: 'Test shop'}}})
    const request = await prepareStoreExecuteRequest({query: 'query { shop { name } }'})

    const result = await runAdminStoreGraphQLOperation({context, request})

    expect(result).toEqual({data: {shop: {name: 'Test shop'}}})
    expect(graphqlRequest).toHaveBeenCalledWith({
      query: 'query { shop { name } }',
      api: 'Admin',
      url: 'https://shop.myshopify.com/admin/api/2025-10/graphql.json',
      token: 'token',
      variables: undefined,
      responseOptions: {handleErrors: false},
    })
  })

  test('clears stored auth and throws a re-auth error on 401 using the real session scopes', async () => {
    vi.mocked(graphqlRequest).mockRejectedValue({response: {status: 401}})
    const request = await prepareStoreExecuteRequest({query: 'query { shop { name } }'})

    await expect(runAdminStoreGraphQLOperation({context, request})).rejects.toMatchObject({
      message: `Stored app authentication for ${store} is no longer valid.`,
      tryMessage: 'To re-authenticate, run:',
      nextSteps: [[{command: `shopify store auth --store ${store} --scopes read_products,write_orders`}]],
    })
    expect(clearStoredStoreAppSession).toHaveBeenCalledWith(store, '42')
  })

  test('throws a GraphQL operation error when errors are returned', async () => {
    vi.mocked(graphqlRequest).mockRejectedValue({response: {errors: [{message: 'Field does not exist'}]}})
    const request = await prepareStoreExecuteRequest({query: 'query { nope }'})

    await expect(runAdminStoreGraphQLOperation({context, request})).rejects.toThrow('GraphQL operation failed.')
  })

  test('rethrows non-GraphQL errors', async () => {
    vi.mocked(graphqlRequest).mockRejectedValue(new Error('boom'))
    const request = await prepareStoreExecuteRequest({query: 'query { shop { name } }'})

    await expect(runAdminStoreGraphQLOperation({context, request})).rejects.toThrow('boom')
  })
})
