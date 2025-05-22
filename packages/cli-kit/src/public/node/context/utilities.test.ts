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

  test('returns false for undefined', () => {
    expect(isTruthy(undefined)).toBe(false)
  })

  test('returns false for empty string', () => {
    expect(isTruthy('')).toBe(false)
  })

  test('returns false for "0"', () => {
    expect(isTruthy('0')).toBe(false)
  })

  test('returns false for "false"', () => {
    expect(isTruthy('false')).toBe(false)
  })

  test('returns false for "FALSE"', () => {
    expect(isTruthy('FALSE')).toBe(false)
  })

  test('returns false for "no"', () => {
    expect(isTruthy('no')).toBe(false)
  })

  test('returns false for "NO"', () => {
    expect(isTruthy('NO')).toBe(false)
  })

  test('returns false for random string', () => {
    expect(isTruthy('random-value')).toBe(false)
  })

  test('returns false for string with spaces', () => {
    expect(isTruthy(' 1 ')).toBe(false)
  })

  test('returns false for "True" (mixed case)', () => {
    expect(isTruthy('True')).toBe(false)
  })

  test('returns false for "Yes" (mixed case)', () => {
    expect(isTruthy('Yes')).toBe(false)
  })

  test('returns false for numeric strings other than "1"', () => {
    expect(isTruthy('2')).toBe(false)
    expect(isTruthy('10')).toBe(false)
    expect(isTruthy('-1')).toBe(false)
  })

  test('returns false for special characters', () => {
    expect(isTruthy('!')).toBe(false)
    expect(isTruthy('@')).toBe(false)
    expect(isTruthy('#')).toBe(false)
  })

  test('returns false for boolean-like strings that are not exact matches', () => {
    expect(isTruthy('truthy')).toBe(false)
    expect(isTruthy('trues')).toBe(false)
    expect(isTruthy('yess')).toBe(false)
  })
})
