import {isNetworkAccessEnabled} from './network-access.js'
import {describe, expect, test} from 'vitest'

describe('isNetworkAccessEnabled', () => {
  test.each([
    [true, true],
    [false, false],
    [undefined, false],
    [{allowed_sources: ['https://api.example.com']}, true],
    [{allowed_sources: []}, true],
  ])('treats %j as %s', (networkAccess, expected) => {
    expect(isNetworkAccessEnabled(networkAccess)).toBe(expected)
  })
})
