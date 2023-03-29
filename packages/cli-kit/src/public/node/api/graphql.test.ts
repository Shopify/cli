import {graphqlRequest} from './graphql.js'
import {debugLogResponseInfo} from '../../../private/node/api.js'
import * as debugRequest from '../../../private/node/api/graphql.js'
import {buildHeaders} from '../../../private/node/api/headers.js'
import {GraphQLClient} from 'graphql-request'
import {test, vi, describe, expect, beforeEach} from 'vitest'
import {Headers} from 'node-fetch'

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
  vi.mocked(debugLogResponseInfo).mockResolvedValue({
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
    expect(GraphQLClient.prototype.rawRequest).toHaveBeenCalledWith('query', mockVariables)
    expect(debugRequest.debugLogRequestInfo).toHaveBeenCalledOnce()
    const receivedObject = {
      request: undefined,
      url: mockedAddress,
    }
    expect(debugLogResponseInfo).toHaveBeenCalledWith(receivedObject, expect.any(Function))
  })
})
