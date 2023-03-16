import {requestApiVersions} from './request-api-versions.js'
import {partnersRequest} from '../app/partners-request.js'
import {describe, expect, it, vi} from 'vitest'

vi.mock('../app/partners-request.js')

const aToken = 'A_TOKEN'

describe('requestApiVersions', () => {
  it('calls partners to request data and returns ordered array', async () => {
    // Given
    const graphQLResult = {
      publicApiVersions: ['2022', 'unstable', '2023'],
    }
    vi.mocked(partnersRequest).mockResolvedValue(graphQLResult)

    // When
    const got = await requestApiVersions(aToken)

    // Then
    expect(got).toEqual(['2023', '2022', 'unstable'])
  })
})
