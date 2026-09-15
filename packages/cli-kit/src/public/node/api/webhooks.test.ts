import {webhooksRequestDoc} from './webhooks.js'
import {graphqlRequestDoc} from './graphql.js'
import {appManagementFqdn} from '../context/fqdn.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import {TypedDocumentNode} from '@graphql-typed-document-node/core'

vi.mock('./graphql.js')
vi.mock('../context/fqdn.js')

const mockedResult = {data: {webhooks: []}}
const appManagementFqdnValue = 'app.shopify.com'
const mockedToken = 'test-token'
const organizationId = '12345'

beforeEach(() => {
  vi.mocked(appManagementFqdn).mockResolvedValue(appManagementFqdnValue)
})

describe('webhooksRequestDoc', () => {
  test('executes graphqlRequestDoc with correct URL and options', async () => {
    // Given
    vi.mocked(graphqlRequestDoc).mockResolvedValue(mockedResult)
    const query = 'query { webhooks }' as unknown as TypedDocumentNode<object, {variables: string}>
    const variables = {variables: 'test-variable'}
    const unauthorizedHandler = {
      type: 'token_refresh' as const,
      handler: vi.fn().mockResolvedValue({token: mockedToken}),
    }

    // When
    const result = await webhooksRequestDoc({
      organizationId,
      query,
      token: mockedToken,
      variables,
      unauthorizedHandler,
    })

    // Then
    expect(result).toBe(mockedResult)
    expect(graphqlRequestDoc).toHaveBeenCalledWith({
      query,
      api: 'Webhooks',
      url: `https://${appManagementFqdnValue}/webhooks/unstable/organizations/${organizationId}/graphql.json`,
      token: mockedToken,
      variables,
      unauthorizedHandler,
    })
  })
})
