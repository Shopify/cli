import {graphqlRequest, graphqlRequestDoc} from './graphql.js'
import * as api from '../../../private/node/api.js'
import * as debugRequest from '../../../private/node/api/graphql.js'
import {buildHeaders} from '../../../private/node/api/headers.js'
import {requestIdsCollection} from '../../../private/node/request-ids.js'
import * as metadata from '../metadata.js'
import * as confStore from '../../../private/node/conf-store.js'
import {inTemporaryDirectory} from '../fs.js'
import {LocalStorage} from '../local-storage.js'
import {ConfSchema} from '../../../private/node/conf-store.js'
import {GraphQLClient} from 'graphql-request'
import {test, vi, describe, expect, beforeEach} from 'vitest'
import {TypedDocumentNode} from '@graphql-typed-document-node/core'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'

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

describe('graphqlRequest with caching', () => {
  test('uses cache when TTL is provided', async () => {
    await inTemporaryDirectory(async (dir) => {
      // Given
      const mockQueryHash = '84f38895-31ed-05b5-0d7b-dbf2f1eecd46e2580db0'
      const mockVariablesHash = 'e6959ad8-4a7c-c23d-e7b8-be1ae774e05751514949'
      const cacheStore = new LocalStorage<ConfSchema>({projectName: 'test', cwd: dir})

      const cacheRetrieveSpy = vi
        .spyOn(confStore, 'cacheRetrieveOrRepopulate')
        .mockResolvedValue(JSON.stringify({data: 'cached-response'}))

      // When
      await graphqlRequest({
        query: 'query',
        api: 'mockApi',
        url: mockedAddress,
        token: mockToken,
        variables: mockVariables,
        cacheOptions: {
          cacheTTL: 1000 * 60 * 60,
          cacheExtraKey: 'extra',
          cacheStore,
        },
      })

      // Then
      expect(cacheRetrieveSpy).toHaveBeenCalledWith(
        `q-${mockQueryHash}-${mockVariablesHash}-${CLI_KIT_VERSION}-extra`,
        expect.any(Function),
        1000 * 60 * 60,
        cacheStore,
      )
    })
  })

  test('uses cache key when no extra key provided', async () => {
    await inTemporaryDirectory(async (dir) => {
      // Given
      const mockQueryHash = '84f38895-31ed-05b5-0d7b-dbf2f1eecd46e2580db0'
      const mockVariablesHash = 'e6959ad8-4a7c-c23d-e7b8-be1ae774e05751514949'

      const cacheStore = new LocalStorage<ConfSchema>({projectName: 'test', cwd: dir})

      const cacheRetrieveSpy = vi
        .spyOn(confStore, 'cacheRetrieveOrRepopulate')
        .mockResolvedValue(JSON.stringify({data: 'cached-response'}))

      // When
      await graphqlRequest({
        query: 'query',
        api: 'mockApi',
        url: mockedAddress,
        token: mockToken,
        variables: mockVariables,
        cacheOptions: {
          cacheTTL: 1000 * 60 * 60 * 24,
          cacheStore,
        },
      })

      // Then
      expect(cacheRetrieveSpy).toHaveBeenCalledWith(
        `q-${mockQueryHash}-${mockVariablesHash}-${CLI_KIT_VERSION}-`,
        expect.any(Function),
        1000 * 60 * 60 * 24,
        cacheStore,
      )
    })
  })

  test('skips cache when no TTL is provided', async () => {
    const retryAwareSpy = vi
      .spyOn(api, 'retryAwareRequest')
      .mockImplementation(async () => ({status: 200, headers: new Headers()}))

    const cacheRetrieveSpy = vi.spyOn(confStore, 'cacheRetrieveOrRepopulate')

    // When
    await graphqlRequest({
      query: 'query',
      api: 'mockApi',
      url: mockedAddress,
      token: mockToken,
      variables: mockVariables,
    })

    // Then
    expect(cacheRetrieveSpy).not.toHaveBeenCalled()
    expect(retryAwareSpy).toHaveBeenCalled()
  })
})
