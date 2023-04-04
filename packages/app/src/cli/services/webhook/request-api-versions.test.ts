import {requestApiVersions} from './request-api-versions.js'
import {describe, expect, vi, test} from 'vitest'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'

vi.mock('@shopify/cli-kit/node/api/partners')

const aToken = 'A_TOKEN'

describe('requestApiVersions', () => {
  test('calls partners to request data and returns ordered array', async () => {
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
