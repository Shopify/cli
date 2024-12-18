import {requestTopics} from './request-topics.js'
import {testDeveloperPlatformClient} from '../../models/app/app.test-data.js'
import {describe, expect, test} from 'vitest'

const aVersion = 'SOME_VERSION'
const anOrganizationId = 'organizationId'

describe('requestTopics', () => {
  test('calls partners to request topics data and returns array', async () => {
    // Given/When
    const got = await requestTopics(testDeveloperPlatformClient(), aVersion, anOrganizationId)

    // Then
    expect(got).toEqual(['orders/create', 'shop/redact'])
  })
})
