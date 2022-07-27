import * as admin from './admin.js'
import {buildHeaders} from './common.js'
import {AdminSession} from '../session.js'
import {graphqlClient} from '../http/graphql.js'
import {test, vi, expect, describe, beforeEach} from 'vitest'
import {GraphQLClient} from 'graphql-request'

vi.mock('../http/graphql.js')
vi.mock('./common.js')

let client: GraphQLClient
beforeEach(() => {
  client = {
    request: vi.fn(),
  } as any
  vi.mocked(graphqlClient).mockResolvedValue(client)
})

const mockedResult = {
  publicApiVersions: [
    {
      handle: '2021-01',
      supported: false,
    },
    {
      handle: '2022-01',
      supported: true,
    },
    {
      handle: '2019-01',
      supported: true,
    },
  ],
}

const token = 'token'
const Session: AdminSession = {token, storeFqdn: 'store'}

describe('admin-api', () => {
  test('calls the graphql client twice: get api version and then execute the request', async () => {
    // Given
    vi.mocked(client.request).mockResolvedValue(mockedResult)

    // When
    await admin.request('query', Session, {})

    // Then
    expect(client.request).toHaveBeenCalledTimes(2)
  })

  test('request is called with correct parameters', async () => {
    // Given
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const headers = {'custom-header': token}
    vi.mocked(client.request).mockResolvedValue(mockedResult)
    vi.mocked(buildHeaders).mockResolvedValue(headers)

    // When
    await admin.request('query', Session, {variables: 'variables'})

    // Then
    expect(client.request).toHaveBeenLastCalledWith('query', {variables: 'variables'})
  })

  test('buildHeaders is called with user token', async () => {
    // Given
    vi.mocked(client.request).mockResolvedValue(mockedResult)

    // When
    await admin.request('query', Session, {})

    // Then
    expect(buildHeaders).toHaveBeenCalledWith(token)
  })
})
