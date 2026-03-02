import {handleGraphql} from './graphql.js'
import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest'
import type {SessionManager} from '../session-manager.js'

const mockAdminRequest = vi.fn()

vi.mock('@shopify/cli-kit/node/api/admin', () => ({
  adminRequest: (...args: unknown[]) => mockAdminRequest(...args),
}))

function createMockSessionManager(): SessionManager {
  return {
    getSession: vi.fn(),
    startAuth: vi.fn(),
    requireSession: vi.fn(),
    clearSession: vi.fn(),
  } as unknown as SessionManager
}

describe('handleGraphql', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = {...originalEnv}
    delete process.env.SHOPIFY_FLAG_STORE
  })

  afterEach(() => {
    process.env = originalEnv
  })

  test('returns error when no store specified', async () => {
    const sm = createMockSessionManager()
    const result = await handleGraphql(sm, {query: '{ shop { name } }', allowMutations: false})

    expect(result.isError).toBe(true)
    expect(result.content[0]!.text).toContain('No store specified')
  })

  test('blocks mutations without allowMutations flag', async () => {
    process.env.SHOPIFY_FLAG_STORE = 'test.myshopify.com'
    const sm = createMockSessionManager()

    const result = await handleGraphql(sm, {query: 'mutation { productDelete(input: {id: "1"}) { deletedProductId } }', allowMutations: false})

    expect(result.isError).toBe(true)
    expect(result.content[0]!.text).toContain('allowMutations: true')
  })

  test('allows mutations with allowMutations flag', async () => {
    process.env.SHOPIFY_FLAG_STORE = 'test.myshopify.com'
    const sm = createMockSessionManager()
    const session = {token: 'abc', storeFqdn: 'test.myshopify.com'}
    ;(sm.requireSession as ReturnType<typeof vi.fn>).mockResolvedValue(session)
    mockAdminRequest.mockResolvedValue({data: {productDelete: {deletedProductId: '1'}}})

    const result = await handleGraphql(sm, {
      query: 'mutation { productDelete(input: {id: "1"}) { deletedProductId } }',
      allowMutations: true,
    })

    expect(result.isError).toBeUndefined()
    expect(mockAdminRequest).toHaveBeenCalledWith('mutation { productDelete(input: {id: "1"}) { deletedProductId } }', session, undefined)
  })

  test('executes query and returns JSON result', async () => {
    process.env.SHOPIFY_FLAG_STORE = 'test.myshopify.com'
    const sm = createMockSessionManager()
    const session = {token: 'abc', storeFqdn: 'test.myshopify.com'}
    ;(sm.requireSession as ReturnType<typeof vi.fn>).mockResolvedValue(session)
    mockAdminRequest.mockResolvedValue({data: {shop: {name: 'Test Store'}}})

    const result = await handleGraphql(sm, {query: '{ shop { name } }', allowMutations: false})

    expect(result.isError).toBeUndefined()
    const parsed = JSON.parse(result.content[0]!.text)
    expect(parsed.data.shop.name).toBe('Test Store')
  })

  test('passes variables to adminRequest', async () => {
    process.env.SHOPIFY_FLAG_STORE = 'test.myshopify.com'
    const sm = createMockSessionManager()
    const session = {token: 'abc', storeFqdn: 'test.myshopify.com'}
    ;(sm.requireSession as ReturnType<typeof vi.fn>).mockResolvedValue(session)
    mockAdminRequest.mockResolvedValue({data: {node: {id: 'gid://shopify/Product/1'}}})

    const variables = {id: 'gid://shopify/Product/1'}
    await handleGraphql(sm, {query: 'query($id: ID!) { node(id: $id) { id } }', variables, allowMutations: false})

    expect(mockAdminRequest).toHaveBeenCalledWith('query($id: ID!) { node(id: $id) { id } }', session, variables)
  })

  test('returns auth error when not authenticated', async () => {
    process.env.SHOPIFY_FLAG_STORE = 'test.myshopify.com'
    const sm = createMockSessionManager()
    ;(sm.requireSession as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Not authenticated for store test.myshopify.com. Call shopify_auth_login first.'))

    const result = await handleGraphql(sm, {query: '{ shop { name } }', allowMutations: false})

    expect(result.isError).toBe(true)
    expect(result.content[0]!.text).toContain('shopify_auth_login')
  })

  test('clears session and returns error on 401', async () => {
    process.env.SHOPIFY_FLAG_STORE = 'test.myshopify.com'
    const sm = createMockSessionManager()
    const session = {token: 'expired', storeFqdn: 'test.myshopify.com'}
    ;(sm.requireSession as ReturnType<typeof vi.fn>).mockResolvedValue(session)
    mockAdminRequest.mockRejectedValue(new Error('401 Unauthorized'))

    const result = await handleGraphql(sm, {query: '{ shop { name } }', allowMutations: false})

    expect(result.isError).toBe(true)
    expect(result.content[0]!.text).toContain('Session expired')
    expect(sm.clearSession).toHaveBeenCalledWith('test.myshopify.com')
  })

  test('returns GraphQL error for non-auth failures', async () => {
    process.env.SHOPIFY_FLAG_STORE = 'test.myshopify.com'
    const sm = createMockSessionManager()
    const session = {token: 'abc', storeFqdn: 'test.myshopify.com'}
    ;(sm.requireSession as ReturnType<typeof vi.fn>).mockResolvedValue(session)
    mockAdminRequest.mockRejectedValue(new Error('Field "invalid" not found on type "Shop"'))

    const result = await handleGraphql(sm, {query: '{ shop { invalid } }', allowMutations: false})

    expect(result.isError).toBe(true)
    expect(result.content[0]!.text).toContain('GraphQL error')
    expect(result.content[0]!.text).toContain('Field "invalid" not found')
  })

  test('detects mutations with leading comments', async () => {
    process.env.SHOPIFY_FLAG_STORE = 'test.myshopify.com'
    const sm = createMockSessionManager()
    const result = await handleGraphql(sm, {
      query: '# comment\nmutation { productDelete(input: {id: "1"}) { deletedProductId } }',
      allowMutations: false,
    })
    expect(result.isError).toBe(true)
    expect(result.content[0]!.text).toContain('allowMutations')
  })

  test('mutation pattern detection', () => {
    const pattern = /^\s*mutation[\s({]/i
    expect(pattern.test('mutation { shop { name } }')).toBe(true)
    expect(pattern.test('  mutation CreateProduct($input: ProductInput!) { }')).toBe(true)
    expect(pattern.test('mutation(')).toBe(true)
    expect(pattern.test('MUTATION { }')).toBe(true)
    expect(pattern.test('Mutation { }')).toBe(true)
    expect(pattern.test('query { shop { name } }')).toBe(false)
    expect(pattern.test('{ shop { name } }')).toBe(false)
    expect(pattern.test('query GetMutationResults { }')).toBe(false)
  })

  test('sanitizes tokens and paths in error messages', async () => {
    process.env.SHOPIFY_FLAG_STORE = 'test.myshopify.com'
    const sm = createMockSessionManager()
    const session = {token: 'abc', storeFqdn: 'test.myshopify.com'}
    ;(sm.requireSession as ReturnType<typeof vi.fn>).mockResolvedValue(session)
    mockAdminRequest.mockRejectedValue(new Error('Request failed with Bearer secretToken123 at /Users/dev/secret'))

    const result = await handleGraphql(sm, {query: '{ shop { name } }', allowMutations: false})

    expect(result.isError).toBe(true)
    expect(result.content[0]!.text).toContain('Bearer [REDACTED]')
    expect(result.content[0]!.text).toContain('[PATH]')
    expect(result.content[0]!.text).not.toContain('secretToken123')
    expect(result.content[0]!.text).not.toContain('/Users/dev')
  })
})
