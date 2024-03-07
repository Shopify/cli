import {requestApiVersions} from './request-api-versions.js'
import {testDeveloperPlatformClient} from '../../models/app/app.test-data.js'
import {describe, expect, test} from 'vitest'

const developerPlatformClient = testDeveloperPlatformClient()

describe('requestApiVersions', () => {
  test('calls partners to request data and returns ordered array', async () => {
    // Given - When
    const got = await requestApiVersions(developerPlatformClient)

    // Then
    expect(got).toEqual(['2023', '2022', 'unstable'])
  })
})
