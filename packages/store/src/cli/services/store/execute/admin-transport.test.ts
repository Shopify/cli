import {prepareStoreExecuteRequest} from './request.js'
import {
  ABORTED_FETCH_MESSAGE_FRAGMENTS,
  fetchPublicApiVersions,
  runAdminStoreGraphQLOperation,
} from './admin-transport.js'
import {clearStoredStoreAppSession} from '../auth/session-store.js'
import {STORE_AUTH_APP_CLIENT_ID} from '../auth/config.js'
import {recordStoreCommandShopIdFromAdminGid} from '../metrics.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {adminUrl} from '@shopify/cli-kit/node/api/admin'
import {graphqlRequest} from '@shopify/cli-kit/node/api/graphql'
import {AbortError, BugError} from '@shopify/cli-kit/node/error'
import {renderSingleTask} from '@shopify/cli-kit/node/ui'

vi.mock('../auth/session-store.js')
vi.mock('../metrics.js')
vi.mock('@shopify/cli-kit/node/api/graphql')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/api/admin', async () => {
  const actual = await vi.importActual<typeof import('@shopify/cli-kit/node/api/admin')>(
    '@shopify/cli-kit/node/api/admin',
  )
  return {
    ...actual,
    adminUrl: vi.fn(),
  }
})

// Structural fake of graphql-request's `ClientError` — the trap matches on shape, not on
// the imported class, so we don't pull `graphql-request` into `@shopify/store`.
function makeClientErrorLike(status: number, message = 'GraphQL Error'): Error {
  const error = new Error(message) as Error & {response: {status: number; errors: {message: string}[]}}
  error.response = {status, errors: [{message}]}
  return error
}

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
    // Echo the inputs back into the URL so tests can verify the right store/version were
    // passed in (a constant return value would mask `adminUrl(wrongStore, wrongVersion)`).
    vi.mocked(adminUrl).mockImplementation((store, version) => `https://${store}/admin/api/${version}/graphql.json`)
    vi.mocked(renderSingleTask).mockImplementation(async ({task}) => task(() => {}))
  })

  test('executes the GraphQL request successfully', async () => {
    vi.mocked(graphqlRequest).mockResolvedValue({data: {shop: {name: 'Test shop'}}})
    const request = await prepareStoreExecuteRequest({query: 'query { shop { name } }'})

    const result = await runAdminStoreGraphQLOperation({context, request})

    expect(result).toEqual({data: {shop: {name: 'Test shop'}}})
    expect(adminUrl).toHaveBeenCalledWith(store, '2025-10', context.adminSession)
    expect(graphqlRequest).toHaveBeenCalledWith({
      query: 'query { shop { name } }',
      api: 'Admin',
      url: `https://${store}/admin/api/2025-10/graphql.json`,
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

  test('also clears stored auth on a 401 ClientError-shaped rejection', async () => {
    vi.mocked(graphqlRequest).mockRejectedValue(makeClientErrorLike(401, 'Unauthorized'))
    const request = await prepareStoreExecuteRequest({query: 'query { shop { name } }'})

    await expect(runAdminStoreGraphQLOperation({context, request})).rejects.toMatchObject({
      message: `Stored app authentication for ${store} is no longer valid.`,
    })
    expect(clearStoredStoreAppSession).toHaveBeenCalledWith(store, '42')
  })

  test('throws a GraphQL operation error when errors are returned', async () => {
    vi.mocked(graphqlRequest).mockRejectedValue({response: {errors: [{message: 'Field does not exist'}]}})
    const request = await prepareStoreExecuteRequest({query: 'query { nope }'})

    await expect(runAdminStoreGraphQLOperation({context, request})).rejects.toThrow('GraphQL operation failed.')
  })

  test('maps a 402 ClientError to a store-unavailable AbortError even when the response also carries `errors`', async () => {
    // Branch-ordering regression check: a 402 response that also carries GraphQL `errors`
    // must surface as the store-unavailable AbortError, not the generic "GraphQL operation
    // failed" branch.
    vi.mocked(graphqlRequest).mockRejectedValue(makeClientErrorLike(402, 'Unavailable Shop'))
    const request = await prepareStoreExecuteRequest({query: 'query { shop { name } }'})

    let captured: AbortError | undefined
    await runAdminStoreGraphQLOperation({context, request}).catch((error) => {
      captured = error as AbortError
    })

    expect(captured).toBeInstanceOf(AbortError)
    expect(captured?.message).toBe(`The store ${store} is currently unavailable.`)
    expect(captured?.message).not.toContain('GraphQL operation failed.')
  })

  test('rethrows non-GraphQL errors', async () => {
    vi.mocked(graphqlRequest).mockRejectedValue(new Error('boom'))
    const request = await prepareStoreExecuteRequest({query: 'query { shop { name } }'})

    await expect(runAdminStoreGraphQLOperation({context, request})).rejects.toThrow('boom')
  })

  // A user cancellation or CLI-side fetch timeout during the execute phase must surface as
  // a user-facing AbortError, not be mistaken for an auth failure or wrapped as a bug.
  // Driven off the production constant so adding a new abort-message fragment auto-extends
  // coverage here.
  test.each(ABORTED_FETCH_MESSAGE_FRAGMENTS)(
    'maps user-aborted fetches with message %j to an AbortError, not a CLI bug',
    async (fragment) => {
      vi.mocked(graphqlRequest).mockRejectedValue(new Error(fragment))
      const request = await prepareStoreExecuteRequest({query: 'query { shop { name } }'})

      let captured: AbortError | undefined
      await runAdminStoreGraphQLOperation({context, request}).catch((error) => {
        captured = error as AbortError
      })

      expect(captured).toBeInstanceOf(AbortError)
      expect(captured).not.toBeInstanceOf(BugError)
      expect(captured?.message).toBe(`Request to ${store} was aborted before it completed.`)
      expect(clearStoredStoreAppSession).not.toHaveBeenCalled()
    },
  )

  test('maps user-aborted fetches (name=AbortError) to an AbortError, not a CLI bug', async () => {
    const abort = new Error('aborted')
    abort.name = 'AbortError'
    vi.mocked(graphqlRequest).mockRejectedValue(abort)
    const request = await prepareStoreExecuteRequest({query: 'query { shop { name } }'})

    let captured: AbortError | undefined
    await runAdminStoreGraphQLOperation({context, request}).catch((error) => {
      captured = error as AbortError
    })

    expect(captured).toBeInstanceOf(AbortError)
    expect(captured).not.toBeInstanceOf(BugError)
    expect(clearStoredStoreAppSession).not.toHaveBeenCalled()
  })
})

describe('fetchPublicApiVersions', () => {
  const store = 'shop.myshopify.com'
  const session = {
    store,
    clientId: STORE_AUTH_APP_CLIENT_ID,
    userId: '42',
    accessToken: 'token',
    refreshToken: 'refresh-token',
    scopes: ['read_products', 'write_orders'],
    acquiredAt: '2026-03-27T00:00:00.000Z',
  }
  const adminSession = {token: 'token', storeFqdn: store}

  beforeEach(() => {
    vi.mocked(adminUrl).mockImplementation((s, version) => `https://${s}/admin/api/${version}/graphql.json`)
  })

  test('issues the publicApiVersions query against the unstable Admin endpoint', async () => {
    vi.mocked(graphqlRequest).mockResolvedValue({
      publicApiVersions: [
        {handle: '2025-10', supported: true},
        {handle: '2025-07', supported: true},
      ],
      shop: {id: 'gid://shopify/Shop/123'},
    })

    const result = await fetchPublicApiVersions({adminSession, session})

    expect(result).toEqual([
      {handle: '2025-10', supported: true},
      {handle: '2025-07', supported: true},
    ])
    expect(recordStoreCommandShopIdFromAdminGid).toHaveBeenCalledWith('gid://shopify/Shop/123')
    expect(adminUrl).toHaveBeenCalledWith(store, 'unstable', adminSession)
    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        api: 'Admin',
        token: 'token',
        url: `https://${store}/admin/api/unstable/graphql.json`,
        responseOptions: {handleErrors: false},
      }),
    )
  })

  test('clears stored auth and prompts re-auth when the version request returns 401', async () => {
    vi.mocked(graphqlRequest).mockRejectedValue(makeClientErrorLike(401, 'Unauthorized'))

    await expect(fetchPublicApiVersions({adminSession, session})).rejects.toMatchObject({
      message: `Stored app authentication for ${store} is no longer valid.`,
      tryMessage: 'To re-authenticate, run:',
      nextSteps: [[{command: `shopify store auth --store ${store} --scopes read_products,write_orders`}]],
    })
    expect(clearStoredStoreAppSession).toHaveBeenCalledWith(store, '42')
  })

  test('also handles 404 as a stored-auth-no-longer-valid signal', async () => {
    vi.mocked(graphqlRequest).mockRejectedValue(makeClientErrorLike(404, 'Not Found'))

    await expect(fetchPublicApiVersions({adminSession, session})).rejects.toMatchObject({
      message: `Stored app authentication for ${store} is no longer valid.`,
    })
    expect(clearStoredStoreAppSession).toHaveBeenCalledWith(store, '42')
  })

  test('maps 402 Unavailable Shop to an AbortError without clearing stored auth', async () => {
    vi.mocked(graphqlRequest).mockRejectedValue(makeClientErrorLike(402, 'Unavailable Shop'))

    let captured: AbortError | undefined
    await fetchPublicApiVersions({adminSession, session}).catch((error) => {
      captured = error as AbortError
    })

    expect(captured).toBeInstanceOf(AbortError)
    expect(captured).not.toBeInstanceOf(BugError)
    expect(captured?.message).toBe(`The store ${store} is currently unavailable.`)
    expect(String((captured as unknown as {tryMessage?: string})?.tryMessage ?? '')).toContain(
      'Check the store in the Shopify admin',
    )
    expect(clearStoredStoreAppSession).not.toHaveBeenCalled()
  })

  test.each(ABORTED_FETCH_MESSAGE_FRAGMENTS)(
    'maps user-aborted fetches with message %j to an AbortError without clearing stored auth',
    async (fragment) => {
      vi.mocked(graphqlRequest).mockRejectedValue(new Error(fragment))

      let captured: AbortError | undefined
      await fetchPublicApiVersions({adminSession, session}).catch((error) => {
        captured = error as AbortError
      })

      expect(captured).toBeInstanceOf(AbortError)
      expect(captured).not.toBeInstanceOf(BugError)
      expect(captured?.message).toBe(`Request to ${store} was aborted before it completed.`)
      expect(clearStoredStoreAppSession).not.toHaveBeenCalled()
    },
  )

  test('maps user-aborted fetches (name=AbortError) to an AbortError without clearing stored auth', async () => {
    const abort = new Error('aborted')
    abort.name = 'AbortError'
    vi.mocked(graphqlRequest).mockRejectedValue(abort)

    let captured: AbortError | undefined
    await fetchPublicApiVersions({adminSession, session}).catch((error) => {
      captured = error as AbortError
    })

    expect(captured).toBeInstanceOf(AbortError)
    expect(captured).not.toBeInstanceOf(BugError)
    expect(clearStoredStoreAppSession).not.toHaveBeenCalled()
  })

  test('rethrows unrelated errors', async () => {
    vi.mocked(graphqlRequest).mockRejectedValue(new Error('upstream exploded'))

    await expect(fetchPublicApiVersions({adminSession, session})).rejects.toThrow('upstream exploded')
    expect(clearStoredStoreAppSession).not.toHaveBeenCalled()
  })
})
