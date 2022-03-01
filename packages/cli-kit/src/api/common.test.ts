import {randomUUID} from 'crypto'

import {test, vi, expect, describe} from 'vitest'

import constants from '../constants'

import {buildHeaders} from './common'

vi.mock('crypto')
vi.mock('../version')

describe('common API methods', () => {
  test('headers are built correctly', () => {
    // Given
    vi.mocked(randomUUID).mockReturnValue('random-uuid')

    // When
    const headers = buildHeaders('my-token')

    // Then
    expect(headers).toEqual({
      'X-Shopify-Access-Token': 'my-token',
      'X-Request-Id': 'random-uuid',
      'User-Agent': `Shopify CLI; v=${constants.versions.cli}`,
      'X-Shopify-Cli-Employee': '1',
      authorization: 'my-token',
      'Sec-CH-UA-PLATFORM': process.platform,
    })
  })
})
