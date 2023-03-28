import {requestTopics} from './request-topics.js'
import {describe, expect, vi, test} from 'vitest'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'

vi.mock('@shopify/cli-kit/node/api/partners')

const aToken = 'A_TOKEN'
const aVersion = 'SOME_VERSION'

describe('requestTopics', () => {
  test('calls partners to request topics data and returns array', async () => {
    // Given
    const graphQLResult = {
      webhookTopics: ['orders/create', 'shop/redact'],
    }
    vi.mocked(partnersRequest).mockResolvedValue(graphQLResult)

    // When
    const got = await requestTopics(aToken, aVersion)

    // Then
    expect(got).toEqual(['orders/create', 'shop/redact'])
  })
})
