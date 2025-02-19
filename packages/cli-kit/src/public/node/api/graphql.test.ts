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

describe('sanitizeVariables', () => {
  test('masks sensitive data at the top level', () => {
    const variables = {
      apiKey: 'secret-key',
      normalField: 'normal-value',
      serialized_script: 'sensitive-script'
    }

    const result = debugRequest.sanitizeVariables(variables)
    const parsed = JSON.parse(result)

    expect(parsed.apiKey).toBe('*****')
    expect(parsed.normalField).toBe('normal-value')
    expect(parsed.serialized_script).toBe('*****')
  })

  test('masks sensitive data in deeply nested objects', () => {
    const variables = {
      level1: {
        apiKey: 'secret-key',
        level2: {
          serialized_script: 'sensitive-script',
          normal: 'normal-value'
        }
      },
      topLevel: 'normal'
    }

    const result = debugRequest.sanitizeVariables(variables)
    const parsed = JSON.parse(result)

    expect(parsed.level1.apiKey).toBe('*****')
    expect(parsed.level1.level2.serialized_script).toBe('*****')
    expect(parsed.level1.level2.normal).toBe('normal-value')
    expect(parsed.topLevel).toBe('normal')
  })

  test('handles arrays correctly', () => {
    const variables = {
      items: [
        { apiKey: 'secret1' },
        { apiKey: 'secret2' },
        { normal: 'value' }
      ]
    }

    const result = debugRequest.sanitizeVariables(variables)
    const parsed = JSON.parse(result)

    expect(parsed.items[0].apiKey).toBe('*****')
    expect(parsed.items[1].apiKey).toBe('*****')
    expect(parsed.items[2].normal).toBe('value')
  })

  test('does not change primitive values', () => {
    const variables = {
      number: 123,
      string: 'normal',
      boolean: true,
      null: null,
      undefined: undefined
    }

    const result = debugRequest.sanitizeVariables(variables)
    const parsed = JSON.parse(result)

    expect(parsed.number).toBe(123)
    expect(parsed.string).toBe('normal')
    expect(parsed.boolean).toBe(true)
    expect(parsed.null).toBe(null)
    expect(parsed.undefined).toBe(undefined)
  })

  test('hides values in json string', () => {
    const variables = {
      json: '{"api_version": 1, "serialized_script": "ddddddddd"}'
    }

    const result = debugRequest.sanitizeVariables(variables)
    const parsed = JSON.parse(result)

    expect(parsed.json).toBe('{"api_version":1,"serialized_script":"*****"}')
  })

  test('handling invalid json', () => {
    const variables = {
      json: '{"api_version": 1'
    }

    const result = debugRequest.sanitizeVariables(variables)
    const parsed = JSON.parse(result)

    expect(parsed.json).toBe('{"api_version": 1')
  })
})
