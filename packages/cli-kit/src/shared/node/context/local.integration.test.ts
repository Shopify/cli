import {macAddress} from './local.js'
import {describe, expect, test} from 'vitest'

describe('macAddress', () => {
  test('returns any mac address value', async () => {
    // When
    const got = await macAddress()

    // Then
    expect(got).not.toBeUndefined()
  })
})
