import {requestTopics} from './request-topics.js'
import {partnersRequest} from '../app/partners-request.js'
import {describe, expect, it, vi} from 'vitest'

vi.mock('../app/partners-request.js')

const aToken = 'A_TOKEN'
const aVersion = 'SOME_VERSION'

describe('requestTopics', () => {
  it('calls partners to request topics data and returns array', async () => {
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
