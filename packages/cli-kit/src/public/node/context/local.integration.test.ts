import {macAddress} from './local.js'
import {describe, expect, it} from 'vitest'

describe('macAddress', () => {
  it('returns any mac address value', async () => {
    // When
    const got = await macAddress()

    // Then
    expect(got).not.toBeUndefined()
  })
})
