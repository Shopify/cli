import {isTruthy} from './utilities.js'
import {describe, expect, test} from 'vitest'

describe('isTruthy', () => {
  test('returns true for "1"', () => {
    expect(isTruthy('1')).toBe(true)
  })

  test('returns true for "true"', () => {
    expect(isTruthy('true')).toBe(true)
  })

  test('returns true for "TRUE"', () => {
    expect(isTruthy('TRUE')).toBe(true)
  })

  test('returns true for "yes"', () => {
    expect(isTruthy('yes')).toBe(true)
  })

  test('returns true for "YES"', () => {
    expect(isTruthy('YES')).toBe(true)
  })

  test('returns false for "0"', () => {
    expect(isTruthy('0')).toBe(false)
  })

  test('returns false for "false"', () => {
    expect(isTruthy('false')).toBe(false)
  })

  test('returns false for "no"', () => {
    expect(isTruthy('no')).toBe(false)
  })

  test('returns false for undefined', () => {
    expect(isTruthy(undefined)).toBe(false)
  })

  test('returns false for an empty string', () => {
    expect(isTruthy('')).toBe(false)
  })

  test('returns false for a random string', () => {
    expect(isTruthy('random')).toBe(false)
  })
})
