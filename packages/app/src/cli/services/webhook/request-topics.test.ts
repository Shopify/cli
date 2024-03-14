import {requestTopics} from './request-topics.js'
import {testDeveloperPlatformClient} from '../../models/app/app.test-data.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/api/partners')

const developerPlatformClient = testDeveloperPlatformClient()
const aVersion = 'SOME_VERSION'

describe('requestTopics', () => {
  test('calls partners to request topics data and returns array', async () => {
    // Given/When
    const got = await requestTopics(testDeveloperPlatformClient(), aVersion)

    // Then
    expect(got).toEqual(['orders/create', 'shop/redact'])
  })
})
