import {err, ok, valueOrThrow} from './result.js'
import {describe, expect, it} from 'vitest'

describe('ok', () => {
  it('create ok with value', () => {
    // When
    const result = ok(123)

    // Then
    expect(result.ok).toEqual(true)
    if (result.ok) {
      expect(result.value).toEqual(123)
    }
  })
})

describe('err', () => {
  it('create err without error', () => {
    // When
    const result = err()

    // Then
    expect(result.ok).toEqual(false)
    if (!result.ok) {
      expect(result.error).toEqual(new Error('Unknown error'))
    }
  })

  it('create err with string', () => {
    // When
    const result = err('Custom error string')

    // Then
    expect(result.ok).toEqual(false)
    if (!result.ok) {
      expect(result.error).toEqual(new Error('Custom error string'))
    }
  })

  it('create err with en Error', () => {
    // When
    const result = err(new Error('Custom error object'))

    // Then
    expect(result.ok).toEqual(false)
    if (!result.ok) {
      expect(result.error).toEqual(new Error('Custom error object'))
    }
  })
})

describe('valueOrThrow', () => {
  it('when ok result should return value', () => {
    // When
    const result = valueOrThrow(ok(123))

    // Then
    expect(result).toEqual(123)
  })

  it('when err result and no alternative error to throw should throw err result', () => {
    // When
    const result = () => valueOrThrow(err('custom error'))

    // Then
    expect(result).toThrow(new Error('custom error'))
  })

  it('when err result and an alternative error is used should throw alternative error', () => {
    // When
    const result = () => valueOrThrow(err('custom error'), new Error('alternative error'))

    // Then
    expect(result).toThrow(new Error('alternative error'))
  })
})
