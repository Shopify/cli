import {randomUUID} from 'crypto'

import {test, vi, expect, describe} from 'vitest'

import {currentCLIKitVersion} from '../version'

import {buildHeaders} from './common'

vi.mock('crypto')
vi.mock('../version')

describe('common API methods', () => {
  test('headers are built correctly', () => {
    // Given
    vi.mocked(randomUUID).mockReturnValue('random-uuid')
    vi.mocked(currentCLIKitVersion).mockReturnValue('1.2.3')

    // When
    const headers = buildHeaders('my-token')

    // Then
    expect(headers).toEqual({
      'X-Shopify-Access-Token': 'my-token',
      'X-Request-Id': 'random-uuid',
      'User-Agent': 'Shopify CLI; v=1.2.3',
      'X-Shopify-Cli-Employee': '1',
      authorization: 'my-token',
      'Sec-CH-UA-PLATFORM': process.platform,
    })
  })
})
