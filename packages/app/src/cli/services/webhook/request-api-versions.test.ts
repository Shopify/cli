import {requestApiVersions} from './request-api-versions.js'
import {testDeveloperPlatformClient} from '../../models/app/app.test-data.js'
import {describe, expect, test} from 'vitest'

describe('requestApiVersions', () => {
  test('calls partners to request data and returns ordered array', async () => {
    // Given - When
    const organizationId = 'organizationId'
    const got = await requestApiVersions(testDeveloperPlatformClient(), organizationId)

    // Then
    expect(got).toEqual(['2023', '2022', 'unstable'])
  })
})
