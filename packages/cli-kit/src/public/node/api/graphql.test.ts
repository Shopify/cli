import {graphqlRequest, graphqlRequestDoc} from './graphql.js'
import * as api from '../../../private/node/api.js'
import * as debugRequest from '../../../private/node/api/graphql.js'
import {buildHeaders} from '../../../private/node/api/headers.js'
import {requestIdsCollection} from '../../../private/node/request-ids.js'
import * as metadata from '../metadata.js'
import {GraphQLClient} from 'graphql-request'
import {test, vi, describe, expect, beforeEach} from 'vitest'
import {TypedDocumentNode} from '@graphql-typed-document-node/core'

let mockedRequestId = 'request-id-123'

vi.mock('graphql-request', async () => {
  const actual = await vi.importActual('graphql-request')
  const client = vi.fn()
  client.prototype.rawRequest = () => {
    return {
      status: 200,
      headers: new Headers({
        'x-request-id': mockedRequestId,
      }),
    }
  }

  return {
    ...(actual as object),
    GraphQLClient: client,
  }
})
vi.spyOn(debugRequest, 'debugLogRequestInfo').mockResolvedValue(undefined)

const mockedAddress = 'http://localhost:3000'
const mockVariables = {some: 'variables'}
const mockToken = 'token'
const mockedAddedHeaders = {some: 'header'}

beforeEach(async () => {
  requestIdsCollection.clear()
})

describe('graphqlRequest', () => {
  test('calls debugLogRequestInfo once', async () => {
    // Given
    const retryAwareSpy = vi.spyOn(api, 'retryAwareRequest')

    // When
    await graphqlRequest({
      query: 'query',
      api: 'mockApi',
      url: mockedAddress,
      token: mockToken,
      addedHeaders: mockedAddedHeaders,
      variables: mockVariables,
    })

    // Then
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

    expect(retryAwareSpy).toHaveBeenCalledWith(receivedObject, expect.any(Function), undefined)
  })

  test('Logs the request ids to metadata and requestIdCollection', async () => {
    // Given
    const metadataSpyOn = vi.spyOn(metadata, 'addPublicMetadata').mockImplementation(async () => {})

    // When
    await graphqlRequest({
      query: 'query',
      api: 'mockApi',
      url: mockedAddress,
      token: mockToken,
      addedHeaders: mockedAddedHeaders,
      variables: mockVariables,
    })

    mockedRequestId = 'request-id-456'

    await graphqlRequest({
      query: 'query',
      api: 'mockApi',
      url: mockedAddress,
      token: mockToken,
      addedHeaders: mockedAddedHeaders,
      variables: mockVariables,
    })

    // Then
    expect(requestIdsCollection.getRequestIds()).toEqual(['request-id-123', 'request-id-456'])
    expect(metadataSpyOn).toHaveBeenCalledTimes(2)
    expect(metadataSpyOn.mock.calls[0]![0]()).toEqual({cmd_all_last_graphql_request_id: 'request-id-123'})
    expect(metadataSpyOn.mock.calls[1]![0]()).toEqual({cmd_all_last_graphql_request_id: 'request-id-456'})
  })
})

describe('graphqlRequestDoc', () => {
  test('converts document before querying', async () => {
    // Given
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

    const retryAwareSpy = vi.spyOn(api, 'retryAwareRequest')

    // When
    await graphqlRequestDoc({
      query: document,
      api: 'mockApi',
      url: mockedAddress,
      token: mockToken,
      addedHeaders: mockedAddedHeaders,
      variables: mockVariables,
    })

    // Then
    expect(retryAwareSpy).toHaveBeenCalledWith(
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
      'http://localhost:3000',
      mockVariables,
      expect.anything(),
    )
  })
})
