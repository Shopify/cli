import {isInputDisabled} from './no-input.js'
import {describe, expect, test} from 'vitest'

describe('isInputDisabled', () => {
  test('returns true when --no-input is present', () => {
    expect(isInputDisabled(['node', 'shopify', '--no-input'], {})).toBe(true)
  })

  test('returns true when SHOPIFY_FLAG_NO_INPUT is enabled', () => {
    expect(isInputDisabled([], {SHOPIFY_FLAG_NO_INPUT: 'true'})).toBe(true)
  })

  test('returns false when input is not disabled', () => {
    expect(isInputDisabled([], {})).toBe(false)
  })
})
