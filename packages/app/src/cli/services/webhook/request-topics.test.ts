import {requestTopics} from './request-topics.js'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'

beforeEach(async () => {
  vi.mock('@shopify/cli-kit/node/api/partners')
})

afterEach(async () => {
  vi.clearAllMocks()
})

const aToken = 'A_TOKEN'

describe('requestTopics', () => {
  it('calls partners to request topics data and returns array', async () => {
    // Given
    const graphQLResult = {
      webhookTopics: ['orders/create', 'shop/redact'],
    }
    vi.mocked(partnersRequest).mockResolvedValue(graphQLResult)

    // When
    const got = await requestTopics(aToken)

    // Then
    expect(got).toEqual(['orders/create', 'shop/redact'])
  })
})
