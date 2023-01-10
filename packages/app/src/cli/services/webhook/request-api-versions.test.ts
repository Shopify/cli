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

  it('calls partners to request data', async () => {
    // Given
    const graphQLResult = {
      apiVersions: ['version1', 'version2'],
    }
    vi.mocked(api.partners.request).mockResolvedValue(graphQLResult)

    const requestSpy = vi.spyOn(api.partners, 'request')
    const sessionSpy = vi.spyOn(session, 'ensureAuthenticatedPartners')

    // When
    const got = await requestApiVersions()

    // Then
    expect(sessionSpy).toHaveBeenCalledOnce()
    expect(requestSpy).toHaveBeenCalledWith(expect.any(String), 'A_TOKEN')
    expect(got).toEqual(['version1', 'version2'])
  })
})
