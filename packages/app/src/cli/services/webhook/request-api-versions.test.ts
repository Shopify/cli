import {requestApiVersions} from './request-api-versions.js'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {api} from '@shopify/cli-kit'

beforeEach(async () => {
  vi.mock('@shopify/cli-kit')
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
    vi.mocked(api.partners.request).mockResolvedValue(graphQLResult)

    const requestSpy = vi.spyOn(api.partners, 'request')

    // When
    const got = await requestApiVersions(aToken)

    // Then
    expect(requestSpy).toHaveBeenCalledWith(expect.any(String), aToken)
    expect(got).toEqual(['2023', '2022', 'unstable'])
  })
})
