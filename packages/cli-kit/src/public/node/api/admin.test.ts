import * as admin from './admin.js'
import {AdminSession} from '../../../session.js'
import {graphqlRequest} from '../../../private/node/api/graphql.js'
import {test, vi, expect, describe} from 'vitest'

vi.mock('../../../private/node/api/graphql.js')

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
    vi.mocked(graphqlRequest).mockResolvedValue(mockedResult)

    // When
    await admin.adminRequest('query', Session, {})

    // Then
    expect(graphqlRequest).toHaveBeenCalledTimes(2)
  })

  test('request is called with correct parameters', async () => {
    // Given
    vi.mocked(graphqlRequest).mockResolvedValue(mockedResult)

    // When
    await admin.adminRequest('query', Session, {variables: 'variables'})

    // Then
    expect(graphqlRequest).toHaveBeenLastCalledWith(
      'query',
      'Admin',
      'https://store/admin/api/2022-01/graphql.json',
      token,
      {variables: 'variables'},
    )
  })
})
