import {functionsRequestDoc} from './functions.js'
import {handleDeprecations} from './app-management.js'
import {graphqlRequestDoc} from './graphql.js'
import {appManagementFqdn} from '../context/fqdn.js'
import {test, vi, expect, describe, beforeEach} from 'vitest'
import {TypedDocumentNode} from '@graphql-typed-document-node/core'

vi.mock('./graphql.js')
vi.mock('../context/fqdn.js')

const mockedResult = {data: {app: {id: '123'}}}
const appManagementFqdnValue = 'shopify.com'
const orgId = 'org-123'
const appId = 'app-456'
const token = 'test-token'
const expectedUrl = `https://${appManagementFqdnValue}/functions/unstable/organizations/${orgId}/${appId}/graphql`

beforeEach(() => {
  vi.mocked(appManagementFqdn).mockResolvedValue(appManagementFqdnValue)
})

describe('functionsRequestDoc', () => {
  test('graphqlRequestDoc is called with correct parameters and returns result', async () => {
    vi.mocked(graphqlRequestDoc).mockResolvedValue(mockedResult)

    const query = 'query' as unknown as TypedDocumentNode<typeof mockedResult, {id: string}>
    const unauthorizedHandler = {
      type: 'token_refresh' as const,
      handler: vi.fn().mockResolvedValue({token}),
    }

    const result = await functionsRequestDoc({
      organizationId: orgId,
      appId,
      query,
      token,
      variables: {id: '123'},
      unauthorizedHandler,
    })

    expect(graphqlRequestDoc).toHaveBeenLastCalledWith({
      query,
      api: 'Functions',
      url: expectedUrl,
      token,
      variables: {id: '123'},
      responseOptions: {onResponse: handleDeprecations},
      unauthorizedHandler,
    })
    expect(result).toBe(mockedResult)
  })
})
