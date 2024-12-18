import {graphqlRequest, graphqlRequestDoc} from './graphql.js'
import {retryAwareRequest} from '../../../private/node/api.js'
import * as debugRequest from '../../../private/node/api/graphql.js'
import {buildHeaders} from '../../../private/node/api/headers.js'
import {GraphQLClient} from 'graphql-request'
import {test, vi, describe, expect, beforeEach} from 'vitest'
import {Headers} from 'node-fetch'
import {TypedDocumentNode} from '@graphql-typed-document-node/core'

vi.mock('../../../private/node/api.js')
vi.mock('graphql-request', async () => {
  const actual = await vi.importActual('graphql-request')
  const client = vi.fn()
  client.prototype.rawRequest = vi.fn()

  return {
    ...(actual as object),
    GraphQLClient: client,
  }
})
vi.spyOn(debugRequest, 'debugLogRequestInfo').mockResolvedValue(undefined)

const mockedAddress = 'mockedAddress'
const mockVariables = {some: 'variables'}
const mockToken = 'token'
const mockedAddedHeaders = {some: 'header'}

beforeEach(async () => {
  vi.mocked(retryAwareRequest).mockResolvedValue({
    status: 200,
    headers: {} as Headers,
  })
})

describe('graphqlRequest', () => {
  test('calls debugLogRequestInfo once', async () => {
    await graphqlRequest({
      query: 'query',
      api: 'mockApi',
      url: mockedAddress,
      token: mockToken,
      addedHeaders: mockedAddedHeaders,
      variables: mockVariables,
    })
    expect(GraphQLClient).toHaveBeenCalledWith(mockedAddress, {
      agent: expect.any(Object),
      headers: {
        ...buildHeaders(mockToken),
        some: 'header',
      },
    })
    expect(debugRequest.debugLogRequestInfo).toHaveBeenCalledOnce()
    const receivedObject = {
      request: expect.any(Function),
      url: mockedAddress,
    }
    expect(retryAwareRequest).toHaveBeenCalledWith(receivedObject, expect.any(Function), undefined)
  })
})

describe('graphqlRequestDoc', () => {
  test('converts document before querying', async () => {
    const document = {
      kind: 'Document',
      definitions: [
        {
          kind: 'OperationDefinition',
          operation: 'query',
          name: {kind: 'Name', value: 'QueryName'},
          selectionSet: {
            kind: 'SelectionSet',
            selections: [
              {
                kind: 'Field',
                name: {kind: 'Name', value: 'example'},
              },
            ],
          },
        },
      ],
    } as unknown as TypedDocumentNode<unknown, unknown>

    await graphqlRequestDoc({
      query: document,
      api: 'mockApi',
      url: mockedAddress,
      token: mockToken,
      addedHeaders: mockedAddedHeaders,
      variables: mockVariables,
    })

    expect(retryAwareRequest).toHaveBeenCalledWith(
      {
        request: expect.any(Function),
        url: mockedAddress,
      },
      expect.any(Function),
      undefined,
    )
    expect(debugRequest.debugLogRequestInfo).toHaveBeenCalledWith(
      'mockApi',
      `query QueryName {
  example
}`,
      'mockedAddress',
      mockVariables,
      expect.anything(),
    )
  })
})
