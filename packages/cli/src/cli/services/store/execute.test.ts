import {describe, test, expect, vi, beforeEach} from 'vitest'
import {executeStoreOperation} from './execute.js'
import {getStoredStoreAppSession} from './session.js'
import {STORE_AUTH_APP_CLIENT_ID} from './auth-config.js'
import {fetchApiVersions, adminUrl} from '@shopify/cli-kit/node/api/admin'
import {graphqlRequest} from '@shopify/cli-kit/node/api/graphql'
import {renderSingleTask} from '@shopify/cli-kit/node/ui'
import {fileExists, readFile, writeFile} from '@shopify/cli-kit/node/fs'

vi.mock('./session.js')
vi.mock('@shopify/cli-kit/node/api/graphql')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/fs')
vi.mock('@shopify/cli-kit/node/api/admin', async () => {
  const actual = await vi.importActual<typeof import('@shopify/cli-kit/node/api/admin')>('@shopify/cli-kit/node/api/admin')
  return {
    ...actual,
    fetchApiVersions: vi.fn(),
    adminUrl: vi.fn(),
  }
})

describe('executeStoreOperation', () => {
  const store = 'shop.myshopify.com'
  const session = {token: 'token', storeFqdn: store}
  const storedSession = {
    store,
    clientId: STORE_AUTH_APP_CLIENT_ID,
    userId: '42',
    accessToken: 'token',
    scopes: ['read_products'],
    acquiredAt: '2026-03-27T00:00:00.000Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getStoredStoreAppSession).mockReturnValue(storedSession)
    vi.mocked(fetchApiVersions).mockResolvedValue([
      {handle: '2025-10', supported: true},
      {handle: '2025-07', supported: true},
      {handle: 'unstable', supported: false},
    ] as any)
    vi.mocked(adminUrl).mockReturnValue('https://shop.myshopify.com/admin/api/2025-10/graphql.json')
    vi.mocked(renderSingleTask).mockImplementation(async ({task}) => task(() => {}))
  })

  test('executes a query successfully and returns the GraphQL result', async () => {
    vi.mocked(graphqlRequest).mockResolvedValue({data: {shop: {name: 'Test shop'}}})

    const result = await executeStoreOperation({
      store,
      query: 'query { shop { name } }',
    })

    expect(renderSingleTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.anything(),
      }),
    )
    expect(getStoredStoreAppSession).toHaveBeenCalledWith(store)
    expect(fetchApiVersions).toHaveBeenCalledWith(session)
    expect(graphqlRequest).toHaveBeenCalledWith({
      query: 'query { shop { name } }',
      api: 'Admin',
      url: 'https://shop.myshopify.com/admin/api/2025-10/graphql.json',
      token: 'token',
      variables: undefined,
      responseOptions: {handleErrors: false},
    })
    expect(result).toEqual({data: {shop: {name: 'Test shop'}}})
    expect(writeFile).not.toHaveBeenCalled()
  })

  test('passes parsed variables when provided inline', async () => {
    vi.mocked(graphqlRequest).mockResolvedValue({data: {shop: {id: 'gid://shopify/Shop/1'}}})

    await executeStoreOperation({
      store,
      query: 'query Shop($id: ID!) { shop { id } }',
      variables: '{"id":"gid://shopify/Shop/1"}',
    })

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: {id: 'gid://shopify/Shop/1'},
      }),
    )
  })

  test('reads variables from a file', async () => {
    vi.mocked(fileExists).mockResolvedValue(true)
    vi.mocked(readFile).mockResolvedValue('{"id":"gid://shopify/Shop/1"}' as any)
    vi.mocked(graphqlRequest).mockResolvedValue({data: {shop: {id: 'gid://shopify/Shop/1'}}})

    await executeStoreOperation({
      store,
      query: 'query Shop($id: ID!) { shop { id } }',
      variableFile: '/tmp/variables.json',
    })

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: {id: 'gid://shopify/Shop/1'},
      }),
    )
  })

  test('throws when variables contain invalid JSON', async () => {
    await expect(
      executeStoreOperation({
        store,
        query: 'query { shop { name } }',
        variables: '{invalid json}',
      }),
    ).rejects.toThrow('Invalid JSON')

    expect(graphqlRequest).not.toHaveBeenCalled()
  })

  test('throws when mutations are not explicitly allowed', async () => {
    await expect(
      executeStoreOperation({
        store,
        query: 'mutation { productCreate(product: {title: "Hat"}) { product { id } } }',
      }),
    ).rejects.toThrow('Mutations are disabled by default')

    expect(getStoredStoreAppSession).not.toHaveBeenCalled()
  })

  test('throws when no stored app session exists', async () => {
    vi.mocked(getStoredStoreAppSession).mockReturnValue(undefined)

    await expect(
      executeStoreOperation({
        store,
        query: 'query { shop { name } }',
      }),
    ).rejects.toThrow('No stored app authentication found')
  })

  test('allows mutations when explicitly enabled', async () => {
    vi.mocked(graphqlRequest).mockResolvedValue({data: {productCreate: {product: {id: 'gid://shopify/Product/1'}}}})

    await executeStoreOperation({
      store,
      query: 'mutation { productCreate(product: {title: "Hat"}) { product { id } } }',
      allowMutations: true,
    })

    expect(graphqlRequest).toHaveBeenCalled()
  })

  test('uses the specified API version when provided', async () => {
    vi.mocked(graphqlRequest).mockResolvedValue({data: {shop: {name: 'Test shop'}}})
    vi.mocked(adminUrl).mockReturnValue('https://shop.myshopify.com/admin/api/2025-07/graphql.json')

    await executeStoreOperation({
      store,
      query: 'query { shop { name } }',
      version: '2025-07',
    })

    expect(adminUrl).toHaveBeenCalledWith(store, '2025-07', session)
  })

  test('does not write output as part of the execution service', async () => {
    vi.mocked(graphqlRequest).mockResolvedValue({data: {shop: {name: 'Test shop'}}})

    await executeStoreOperation({
      store,
      query: 'query { shop { name } }',
    })

    expect(writeFile).not.toHaveBeenCalled()
  })

  test('throws when stored auth is no longer valid', async () => {
    vi.mocked(graphqlRequest).mockRejectedValue({
      response: {
        status: 401,
      },
    })

    await expect(
      executeStoreOperation({
        store,
        query: 'query { shop { name } }',
      }),
    ).rejects.toThrow('Stored app authentication for')
  })

  test('throws on GraphQL errors', async () => {
    vi.mocked(graphqlRequest).mockRejectedValue({
      response: {
        errors: [{message: 'Field does not exist'}],
      },
    })

    await expect(
      executeStoreOperation({
        store,
        query: 'query { nope }',
      }),
    ).rejects.toThrow('GraphQL operation failed.')
  })

})
