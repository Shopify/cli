import {requestApiVersions} from './request-api-versions.js'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'

beforeEach(async () => {
  vi.mock('@shopify/cli-kit/node/api/partners')
})

afterEach(async () => {
  vi.clearAllMocks()
})

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
