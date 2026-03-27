import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest'
import {executeStoreOperation} from './execute.js'
import {ensureAuthenticatedAdmin} from '@shopify/cli-kit/node/session'
import {fetchApiVersions, adminUrl} from '@shopify/cli-kit/node/api/admin'
import {graphqlRequest} from '@shopify/cli-kit/node/api/graphql'
import {renderSingleTask, renderSuccess, renderError} from '@shopify/cli-kit/node/ui'
import {fileExists, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('@shopify/cli-kit/node/session')
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

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(ensureAuthenticatedAdmin).mockResolvedValue(session)
    vi.mocked(fetchApiVersions).mockResolvedValue([
      {handle: '2025-10', supported: true},
      {handle: '2025-07', supported: true},
      {handle: 'unstable', supported: false},
    ] as any)
    vi.mocked(adminUrl).mockReturnValue('https://shop.myshopify.com/admin/api/2025-10/graphql.json')
    vi.mocked(renderSingleTask).mockImplementation(async ({task}) => task(() => {}))
  })

  afterEach(() => {
    mockAndCaptureOutput().clear()
  })

  test('executes a query successfully', async () => {
    vi.mocked(graphqlRequest).mockResolvedValue({data: {shop: {name: 'Test shop'}}})
    const output = mockAndCaptureOutput()

    await executeStoreOperation({
      store,
      query: 'query { shop { name } }',
    })

    expect(ensureAuthenticatedAdmin).toHaveBeenCalledWith(store)
    expect(fetchApiVersions).toHaveBeenCalledWith(session)
    expect(graphqlRequest).toHaveBeenCalledWith({
      query: 'query { shop { name } }',
      api: 'Admin',
      url: 'https://shop.myshopify.com/admin/api/2025-10/graphql.json',
      token: 'token',
      variables: undefined,
      responseOptions: {handleErrors: false},
    })
    expect(output.info()).toContain('"name": "Test shop"')
    expect(renderSuccess).toHaveBeenCalledWith({headline: 'Operation succeeded.'})
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

    expect(ensureAuthenticatedAdmin).not.toHaveBeenCalled()
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

  test('writes results to a file when outputFile is provided', async () => {
    vi.mocked(graphqlRequest).mockResolvedValue({data: {shop: {name: 'Test shop'}}})

    await executeStoreOperation({
      store,
      query: 'query { shop { name } }',
      outputFile: '/tmp/results.json',
    })

    expect(writeFile).toHaveBeenCalledWith('/tmp/results.json', expect.stringContaining('Test shop'))
    expect(renderSuccess).toHaveBeenCalledWith({
      headline: 'Operation succeeded.',
      body: 'Results written to /tmp/results.json',
    })
  })

  test('renders GraphQL errors without throwing', async () => {
    vi.mocked(graphqlRequest).mockRejectedValue({
      response: {
        errors: [{message: 'Field does not exist'}],
      },
    })

    await executeStoreOperation({
      store,
      query: 'query { nope }',
    })

    expect(renderError).toHaveBeenCalledWith({
      headline: 'GraphQL operation failed.',
      body: JSON.stringify({errors: [{message: 'Field does not exist'}]}, null, 2),
    })
  })

  test('returns a deterministic mock response in mock mode', async () => {
    const output = mockAndCaptureOutput()

    await executeStoreOperation({
      store,
      query: 'query { shop { name } }',
      variables: '{"foo":"bar"}',
      mock: true,
    })

    expect(ensureAuthenticatedAdmin).not.toHaveBeenCalled()
    expect(fetchApiVersions).not.toHaveBeenCalled()
    expect(graphqlRequest).not.toHaveBeenCalled()
    expect(output.info()).toContain('"mock": true')
    expect(output.info()).toContain('"foo": "bar"')
  })
})
