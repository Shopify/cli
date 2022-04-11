import {buildHeaders} from './common'
import {isShopify} from '../environment/local'
import constants from '../constants'
import {test, vi, expect, describe} from 'vitest'
import {randomUUID} from 'crypto'

vi.mock('crypto')
vi.mock('../environment/local')
vi.mock('../version')

describe('common API methods', () => {
  test('headers are built correctly when user is employee', async () => {
    // Given
    vi.mocked(randomUUID).mockReturnValue('random-uuid')
    vi.mocked(isShopify).mockResolvedValue(true)
    // When
    const headers = await buildHeaders('my-token')

    // Then
    expect(headers).toEqual({
      /* eslint-disable @typescript-eslint/naming-convention */
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': 'Bearer my-token',
      'X-Request-Id': 'random-uuid',
      'User-Agent': `Shopify CLI; v=${constants.versions.cli}`,
      authorization: 'Bearer my-token',
      'Sec-CH-UA-PLATFORM': process.platform,
      /* eslint-enable @typescript-eslint/naming-convention */
    })
  })

  test('when user is not employee, do not include header', async () => {
    // Given
    vi.mocked(randomUUID).mockReturnValue('random-uuid')
    vi.mocked(isShopify).mockResolvedValue(false)
    // When
    const headers = await buildHeaders('my-token')

    // Then
    expect(headers).toEqual({
      /* eslint-disable @typescript-eslint/naming-convention */
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': 'Bearer my-token',
      'X-Request-Id': 'random-uuid',
      'User-Agent': `Shopify CLI; v=${constants.versions.cli}`,
      authorization: 'Bearer my-token',
      'Sec-CH-UA-PLATFORM': process.platform,
      /* eslint-enable @typescript-eslint/naming-convention */
    })
  })
})
