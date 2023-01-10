import {requestApiVersions} from './request-api-versions.js'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {api, session} from '@shopify/cli-kit'

beforeEach(async () => {
  vi.mock('@shopify/cli-kit')
})

afterEach(async () => {
  vi.clearAllMocks()
})

describe('requestApiVersions', () => {
  beforeEach(async () => {
    vi.mocked(session.ensureAuthenticatedPartners).mockResolvedValue('A_TOKEN')
  })

  it('calls partners to request data and returns ordered array', async () => {
    // Given
    const graphQLResult = {
      publicApiVersions: ['2022', 'unstable', '2023'],
    }
    vi.mocked(api.partners.request).mockResolvedValue(graphQLResult)

    const requestSpy = vi.spyOn(api.partners, 'request')
    const sessionSpy = vi.spyOn(session, 'ensureAuthenticatedPartners')

    // When
    const got = await requestApiVersions()

    // Then
    expect(sessionSpy).toHaveBeenCalledOnce()
    expect(requestSpy).toHaveBeenCalledWith(expect.any(String), 'A_TOKEN')
    expect(got).toEqual(['2023', '2022', 'unstable'])
  })
})
