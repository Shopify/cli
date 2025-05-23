import {graphqlRequest, graphqlRequestDoc, UnauthorizedHandler} from './graphql.js'
import * as api from '../../../private/node/api.js'
import * as debugRequest from '../../../private/node/api/graphql.js'
import {requestIdsCollection} from '../../../private/node/request-ids.js'
import * as metadata from '../metadata.js'
import * as confStore from '../../../private/node/conf-store.js'
import {inTemporaryDirectory} from '../fs.js'
import {LocalStorage} from '../local-storage.js'
import {ConfSchema, GraphQLRequestKey} from '../../../private/node/conf-store.js'
import {nonRandomUUID} from '../crypto.js'
import {CLI_KIT_VERSION} from '../../common/version.js'
import {test, vi, describe, expect, beforeEach, beforeAll, afterAll, afterEach} from 'vitest'
import {TypedDocumentNode} from '@graphql-typed-document-node/core'
import {setupServer} from 'msw/node'
import {graphql, HttpResponse} from 'msw'

let mockedRequestId = 'request-id-123'

vi.spyOn(debugRequest, 'debugLogRequestInfo').mockResolvedValue(undefined)

const mockedAddress = 'https://shopify.example/graphql'
const mockVariables = {some: 'variables'}
const mockToken = 'token'
const mockedAddedHeaders = {some: 'header'}

beforeEach(async () => {
  requestIdsCollection.clear()
})

const mockApi = graphql.link('https://shopify.example/graphql')
const mockUnauthorizedHandler: UnauthorizedHandler = {
  type: 'token_refresh',
  handler: () => Promise.resolve({token: mockToken}),
}

const handlers = [
  mockApi.query('QueryName', ({query}) => {
    return HttpResponse.json(
      {
        data: {
          QueryName: {example: 'hello'},
        },
      },
      {
        headers: {
          'x-request-id': mockedRequestId,
        },
      },
    )
  }),
  mockApi.query('Fails', () => {
    return HttpResponse.json(
      {
        errors: [
          {
            message: `Cannot do the thing`,
          },
        ],
      },
      {
        headers: {
          'x-request-id': 'failed-request-id',
        },
      },
    )
  }),
  mockApi.query('FailsWithUnauthorized', () => {
    return HttpResponse.json(
      {
        errors: [
          {
            message: `not authorized`,
          },
        ],
      },
      {
        status: 401,
        headers: {
          'x-request-id': 'failed-request-id',
        },
      },
    )
  }),
  mockApi.query('FailsWithBadRequest', () => {
    return HttpResponse.json(
      {
        errors: [
          {
            message: `bad request`,
          },
        ],
      },
      {
        status: 400,
        headers: {
          'x-request-id': 'failed-request-id',
        },
      },
    )
  }),
  mockApi.mutation('MutationName', ({query, variables}) => {
    return HttpResponse.json(
      {
        data: {
          MutationName: {example: variables.some},
        },
      },
      {
        headers: {
          'x-request-id': mockedRequestId,
        },
      },
    )
  }),
]

const server = setupServer(...handlers)
beforeAll(() => server.listen({onUnhandledRequest: 'error'}))
afterAll(() => server.close())
afterEach(() => {
  server.resetHandlers()
  server.events.removeAllListeners()
})

describe('graphqlRequest', () => {
  test('calls debugLogRequestInfo once', async () => {
    let headers: any
    server.events.on('request:start', ({request}) => {
      headers = {}
      request.headers.forEach((value, key) => {
        headers[key] = value
      })
    })

    // When
    const res = await graphqlRequest({
      query: 'query QueryName { example }',
      api: 'mockApi',
      url: mockedAddress,
      token: mockToken,
      addedHeaders: mockedAddedHeaders,
      variables: mockVariables,
      unauthorizedHandler: mockUnauthorizedHandler,
    })
    expect(debugRequest.debugLogRequestInfo).toHaveBeenCalledOnce()

    // user agents varies a lot
    const {'user-agent': userAgent, 'sec-ch-ua-platform': _platform, ...otherHeaders} = headers
    expect(otherHeaders).toMatchInlineSnapshot(`
      {
        "accept": "*/*",
        "accept-encoding": "gzip,deflate",
        "authorization": "Bearer token",
        "connection": "close",
        "content-length": "100",
        "content-type": "application/json",
        "host": "shopify.example",
        "keep-alive": "timeout=30",
        "some": "header",
        "x-shopify-access-token": "Bearer token",
      }
    `)
    expect(res).toMatchInlineSnapshot(`
      {
        "QueryName": {
          "example": "hello",
        },
      }
    `)

    expect(userAgent).toMatch(new RegExp(`Shopify CLI; v=${CLI_KIT_VERSION}`))
  })

  test('Logs the request ids to metadata and requestIdCollection', async () => {
    // Given
    const metadataSpyOn = vi.spyOn(metadata, 'addPublicMetadata').mockImplementation(async () => {})

    // When
    await graphqlRequest({
      query: 'query QueryName { example }',
      api: 'mockApi',
      url: mockedAddress,
      token: mockToken,
      addedHeaders: mockedAddedHeaders,
      variables: mockVariables,
      unauthorizedHandler: mockUnauthorizedHandler,
    })

    mockedRequestId = 'request-id-456'

    await graphqlRequest({
      query: 'query QueryName { example }',
      api: 'mockApi',
      url: mockedAddress,
      token: mockToken,
      addedHeaders: mockedAddedHeaders,
      variables: mockVariables,
      unauthorizedHandler: mockUnauthorizedHandler,
    })

    // Then
    expect(requestIdsCollection.getRequestIds()).toEqual(['request-id-123', 'request-id-456'])
    expect(metadataSpyOn).toHaveBeenCalledTimes(2)
    expect(metadataSpyOn.mock.calls[0]![0]()).toEqual({cmd_all_last_graphql_request_id: 'request-id-123'})
    expect(metadataSpyOn.mock.calls[1]![0]()).toEqual({cmd_all_last_graphql_request_id: 'request-id-456'})
  })

  test('calls onResponseHandler', async () => {
    // When
    let data
    const onResponseHandler = vi.fn().mockImplementation((res) => {
      data = res.data
    })
    await graphqlRequest({
      query: 'query QueryName { example }',
      api: 'mockApi',
      url: mockedAddress,
      token: mockToken,
      addedHeaders: mockedAddedHeaders,
      variables: mockVariables,
      responseOptions: {
        onResponse: onResponseHandler,
      },
      unauthorizedHandler: mockUnauthorizedHandler,
    })
    expect(data).toMatchInlineSnapshot(`
      {
        "QueryName": {
          "example": "hello",
        },
      }
    `)
  })

  test('logs the last request id from a failed request', async () => {
    const metadataSpyOn = vi.spyOn(metadata, 'addPublicMetadata').mockImplementation(async () => {})
    const res = graphqlRequest({
      query: 'query Fails { example }',
      api: 'mockApi',
      url: mockedAddress,
      token: mockToken,
      unauthorizedHandler: mockUnauthorizedHandler,
    })

    await expect(res).rejects.toThrow('Cannot do the thing')

    expect(metadataSpyOn).toHaveBeenCalledTimes(1)
    expect(metadataSpyOn.mock.calls[0]![0]()).toMatchInlineSnapshot(`
      {
        "cmd_all_last_graphql_request_id": "failed-request-id",
      }
    `)
  })

  test('Fails without retry when unauthorized and no token refresh function is provided', async () => {
    const res = graphqlRequest({
      query: 'query FailsWithUnauthorized { example }',
      api: 'mockApi',
      url: mockedAddress,
      token: mockToken,
      unauthorizedHandler: mockUnauthorizedHandler,
    })

    let requestCount = 0
    server.events.on('request:start', () => {
      requestCount++
    })

    await expect(res).rejects.toThrow('not authorized')
    expect(requestCount).toBe(1)
  })

  test('Fails without retry when unauthorized and a token refresh function cannot refresh the token', async () => {
    const res = graphqlRequest({
      query: 'query FailsWithUnauthorized { example }',
      api: 'mockApi',
      url: mockedAddress,
      token: mockToken,
      unauthorizedHandler: {type: 'token_refresh', handler: async () => ({token: undefined})},
    })

    let requestCount = 0
    server.events.on('request:start', () => {
      requestCount++
    })

    await expect(res).rejects.toThrow('not authorized')
    expect(requestCount).toBe(1)
  })

  test('Retries once with refreshed token when unauthorized and refresh succeeds', async () => {
    const res = graphqlRequest({
      query: 'query FailsWithUnauthorized { example }',
      api: 'mockApi',
      url: mockedAddress,
      token: mockToken,
      unauthorizedHandler: {type: 'token_refresh', handler: async () => ({token: 'refreshed-token'})},
    })

    let requestCount = 0
    server.events.on('request:start', () => {
      requestCount++
    })

    await expect(res).rejects.toThrow('not authorized')
    expect(requestCount).toBe(2)
  })

  test('Fails without retry when bad request when unauthorized handler is provided', async () => {
    const res = graphqlRequest({
      query: 'query FailsWithBadRequest { example }',
      api: 'mockApi',
      url: mockedAddress,
      token: mockToken,
      responseOptions: {handleErrors: false},
      unauthorizedHandler: {type: 'token_refresh', handler: async () => ({token: 'refreshed-token'})},
    })
    let requestCount = 0
    server.events.on('request:start', () => {
      requestCount++
    })

    await expect(res).rejects.toThrow('bad request')
    expect(requestCount).toBe(1)
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

    // When
    const res = await graphqlRequestDoc({
      query: document,
      api: 'mockApi',
      url: mockedAddress,
      token: mockToken,
      addedHeaders: mockedAddedHeaders,
      variables: mockVariables,
      unauthorizedHandler: mockUnauthorizedHandler,
    })
    expect(res).toMatchInlineSnapshot(`
      {
        "QueryName": {
          "example": "hello",
        },
      }
    `)

    expect(debugRequest.debugLogRequestInfo).toHaveBeenCalledWith(
      'mockApi',
      `query QueryName {
  example
}`,
      'https://shopify.example/graphql',
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
      serialized_script: 'sensitive-script',
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
          normal: 'normal-value',
        },
      },
      topLevel: 'normal',
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
      items: [{apiKey: 'secret1'}, {apiKey: 'secret2'}, {normal: 'value'}],
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
      undefined,
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
      json: '{"api_version": 1, "serialized_script": "ddddddddd"}',
    }

    const result = debugRequest.sanitizeVariables(variables)
    const parsed = JSON.parse(result)

    expect(parsed.json).toBe('{"api_version":1,"serialized_script":"*****"}')
  })

  test('handling invalid json', () => {
    const variables = {
      json: '{"api_version": 1',
    }

    const result = debugRequest.sanitizeVariables(variables)
    const parsed = JSON.parse(result)

    expect(parsed.json).toBe('{"api_version": 1')
  })
})

describe('graphqlRequest with caching', () => {
  test('uses cache when TTL is provided', async () => {
    vi.useFakeTimers()
    await inTemporaryDirectory(async (dir) => {
      let requestCount = 0
      server.events.on('request:start', () => {
        requestCount++
      })

      const cacheStore = new LocalStorage<ConfSchema>({projectName: 'test', cwd: dir})
      const mutationHash = nonRandomUUID('mutation MutationName($some: String!) { example }')
      const firstVariablesHash = nonRandomUUID(JSON.stringify(mockVariables))
      const otherVariablesHash = nonRandomUUID(JSON.stringify({...mockVariables, some: 'new-value'}))

      // make first request
      const firstRes = graphqlRequest({
        query: 'mutation MutationName($some: String!) { example }',
        api: 'mockApi',
        url: mockedAddress,
        token: mockToken,
        variables: mockVariables,
        cacheOptions: {
          cacheTTL: {hours: 1},
          cacheExtraKey: 'extra',
          cacheStore,
        },
        unauthorizedHandler: mockUnauthorizedHandler,
      })
      await vi.runAllTimersAsync()
      await expect(firstRes).resolves.toEqual({MutationName: {example: 'variables'}})
      expect(requestCount).toBe(1)

      // repeated request uses cache
      const secondRes = graphqlRequest({
        query: 'mutation MutationName($some: String!) { example }',
        api: 'mockApi',
        url: mockedAddress,
        token: mockToken,
        variables: mockVariables,
        cacheOptions: {
          cacheTTL: {hours: 1},
          cacheExtraKey: 'extra',
          cacheStore,
        },
        unauthorizedHandler: mockUnauthorizedHandler,
      })
      await vi.runAllTimersAsync()
      await expect(secondRes).resolves.toEqual({MutationName: {example: 'variables'}})
      expect(requestCount).toBe(1)

      // variable changes break the cache
      const thirdRes = graphqlRequest({
        query: 'mutation MutationName($some: String!) { example }',
        api: 'mockApi',
        url: mockedAddress,
        token: mockToken,
        variables: {...mockVariables, some: 'new-value'},
        cacheOptions: {
          cacheTTL: {hours: 1},
          cacheExtraKey: 'extra',
          cacheStore,
        },
        unauthorizedHandler: mockUnauthorizedHandler,
      })
      await vi.runAllTimersAsync()
      await expect(thirdRes).resolves.toEqual({MutationName: {example: 'new-value'}})
      expect(requestCount).toBe(2)

      // extra key breaks the cache
      const fourthRes = graphqlRequest({
        query: 'mutation MutationName($some: String!) { example }',
        api: 'mockApi',
        url: mockedAddress,
        token: mockToken,
        variables: {...mockVariables, some: 'new-value'},
        cacheOptions: {
          cacheTTL: {hours: 1},
          cacheExtraKey: 'other-extra',
          cacheStore,
        },
        unauthorizedHandler: mockUnauthorizedHandler,
      })
      await vi.runAllTimersAsync()
      await expect(fourthRes).resolves.toEqual({MutationName: {example: 'new-value'}})
      expect(requestCount).toBe(3)

      // fast-forward by an hour
      await vi.advanceTimersByTimeAsync(1000 * 60 * 60)
      const fifthRes = graphqlRequest({
        query: 'mutation MutationName($some: String!) { example }',
        api: 'mockApi',
        url: mockedAddress,
        token: mockToken,
        variables: {...mockVariables, some: 'new-value'},
        cacheOptions: {
          cacheTTL: {hours: 1},
          cacheExtraKey: 'other-extra',
          cacheStore,
        },
        unauthorizedHandler: mockUnauthorizedHandler,
      })
      await vi.runAllTimersAsync()
      await expect(fifthRes).resolves.toEqual({MutationName: {example: 'new-value'}})
      expect(requestCount).toBe(4)

      // no extra breaks the cache
      const sixthRes = graphqlRequest({
        query: 'mutation MutationName($some: String!) { example }',
        api: 'mockApi',
        url: mockedAddress,
        token: mockToken,
        variables: {...mockVariables, some: 'new-value'},
        cacheOptions: {
          cacheTTL: {hours: 1},
          cacheStore,
        },
        unauthorizedHandler: mockUnauthorizedHandler,
      })
      await vi.runAllTimersAsync()
      await expect(sixthRes).resolves.toEqual({MutationName: {example: 'new-value'}})
      expect(requestCount).toBe(5)

      // finally, no cache options means no cache
      const seventhRes = graphqlRequest({
        query: 'mutation MutationName($some: String!) { example }',
        api: 'mockApi',
        url: mockedAddress,
        token: mockToken,
        variables: {...mockVariables, some: 'new-value'},
        unauthorizedHandler: mockUnauthorizedHandler,
      })
      await vi.runAllTimersAsync()
      await expect(seventhRes).resolves.toEqual({MutationName: {example: 'new-value'}})
      expect(requestCount).toBe(6)

      const firstKey: GraphQLRequestKey = `q-${mutationHash}-${firstVariablesHash}-${CLI_KIT_VERSION}-extra`
      const withOtherVariablesKey: GraphQLRequestKey = `q-${mutationHash}-${otherVariablesHash}-${CLI_KIT_VERSION}-extra`
      const withOtherExtraKey: GraphQLRequestKey = `q-${mutationHash}-${otherVariablesHash}-${CLI_KIT_VERSION}-other-extra`
      const noExtraKey: GraphQLRequestKey = `q-${mutationHash}-${otherVariablesHash}-${CLI_KIT_VERSION}-`

      expect(cacheStore.get('cache')![firstKey]).toEqual({
        value: '{"MutationName":{"example":"variables"}}',
        timestamp: expect.any(Number),
      })
      expect(cacheStore.get('cache')![withOtherVariablesKey]).toEqual({
        value: '{"MutationName":{"example":"new-value"}}',
        timestamp: expect.any(Number),
      })
      expect(cacheStore.get('cache')![withOtherExtraKey]).toEqual({
        value: '{"MutationName":{"example":"new-value"}}',
        timestamp: expect.any(Number),
      })
      expect(cacheStore.get('cache')![noExtraKey]).toEqual({
        value: '{"MutationName":{"example":"new-value"}}',
        timestamp: expect.any(Number),
      })

      expect(Object.keys(cacheStore.get('cache')!).length).toBe(4)
    })
    vi.useRealTimers()
  })

  test('skips cache when no TTL is provided', async () => {
    const retryAwareSpy = vi
      .spyOn(api, 'retryAwareRequest')
      .mockImplementation(async () => ({status: 200, headers: new Headers()}))

    const cacheRetrieveSpy = vi.spyOn(confStore, 'cacheRetrieveOrRepopulate')

    // When
    await graphqlRequest({
      query: 'query QueryName { example }',
      api: 'mockApi',
      url: mockedAddress,
      token: mockToken,
      variables: mockVariables,
      unauthorizedHandler: mockUnauthorizedHandler,
    })

    // Then
    expect(cacheRetrieveSpy).not.toHaveBeenCalled()
    expect(retryAwareSpy).toHaveBeenCalled()
  })
})
