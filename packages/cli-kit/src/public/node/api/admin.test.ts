import * as admin from './admin.js'
import {AdminSession} from '../../../session.js'
import {buildHeaders} from '../../../private/common/api/headers.js'
import {graphqlRequest} from '../../../private/common/api/graphql.js'
import {test, vi, expect, describe} from 'vitest'

vi.mock('../../../private/common/api/graphql.js')
vi.mock('../../../private/common/api/headers.js', async () => {
  const module: any = await vi.importActual('./common.js')
  return {
    ...module,
    buildHeaders: vi.fn(),
  }
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
    vi.mocked(graphqlRequest).mockResolvedValue(mockedResult)

    // When
    await admin.adminRequest('query', Session, {})

    // Then
    expect(graphqlRequest).toHaveBeenCalledTimes(2)
  })

  test('request is called with correct parameters', async () => {
    // Given
    const headers = {'custom-header': token}
    vi.mocked(graphqlRequest).mockResolvedValue(mockedResult)
    vi.mocked(buildHeaders).mockResolvedValue(headers)

    // When
    await admin.adminRequest('query', Session, {variables: 'variables'})

    // Then
    expect(graphqlRequest).toHaveBeenLastCalledWith('query', {variables: 'variables'})
  })

  test('buildHeaders is called with user token', async () => {
    // Given
    vi.mocked(graphqlRequest).mockResolvedValue(mockedResult)

    // When
    await admin.adminRequest('query', Session, {})

    // Then
    expect(buildHeaders).toHaveBeenCalledWith(token)
  })
})
