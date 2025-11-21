import {adminAsAppRequestDoc} from './admin-as-app.js'
import {graphqlRequestDoc} from '@shopify/cli-kit/node/api/graphql'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {describe, test, expect, vi, beforeEach} from 'vitest'
import {TypedDocumentNode} from '@graphql-typed-document-node/core'

vi.mock('@shopify/cli-kit/node/api/graphql')

describe('adminAsAppRequestDoc', () => {
  const mockSession: AdminSession = {
    token: 'test-app-token',
    storeFqdn: 'test-store.myshopify.com',
  }

  const mockQuery: TypedDocumentNode<{shop: {name: string}}, {id: string}> = {} as any
  const mockVariables = {id: 'gid://shopify/Shop/123'}
  const mockResponse = {shop: {name: 'Test Shop'}}

  beforeEach(() => {
    vi.mocked(graphqlRequestDoc).mockResolvedValue(mockResponse)
  })

  test('calls graphqlRequestDoc with correct parameters', async () => {
    // When
    await adminAsAppRequestDoc({
      query: mockQuery,
      session: mockSession,
      variables: mockVariables,
    })

    // Then
    expect(graphqlRequestDoc).toHaveBeenCalledWith({
      query: mockQuery,
      token: 'test-app-token',
      api: 'Admin',
      url: 'https://test-store.myshopify.com/admin/api/unstable/graphql.json',
      variables: mockVariables,
    })
  })

  test('returns the response from graphqlRequestDoc', async () => {
    // When
    const result = await adminAsAppRequestDoc({
      query: mockQuery,
      session: mockSession,
      variables: mockVariables,
    })

    // Then
    expect(result).toEqual(mockResponse)
  })

  test('works without variables', async () => {
    // When
    await adminAsAppRequestDoc({
      query: mockQuery,
      session: mockSession,
    })

    // Then
    expect(graphqlRequestDoc).toHaveBeenCalledWith({
      query: mockQuery,
      token: 'test-app-token',
      api: 'Admin',
      url: 'https://test-store.myshopify.com/admin/api/unstable/graphql.json',
      variables: undefined,
    })
  })
})
