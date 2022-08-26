import {err, ok} from './result.js'
import {describe, expect, it} from 'vitest'

describe('ok', () => {
  it('create ok with value', () => {
    // When
    const result = ok(123)

    // Then
    expect(result.isOk()).toEqual(true)
    expect(result.valueOrThrow()).toEqual(123)
  })
})

describe('err', () => {
  it('create err with en Error', () => {
    // When
    const result = err(new Error('Custom error object'))

    // Then
    expect(result.isErr()).toEqual(true)
    expect(() => result.valueOrThrow()).toThrow(new Error('Custom error object'))
  })
})

describe('valueOrThrow', () => {
  it('when ok result should return value', () => {
    // When
    const result = ok(123).valueOrThrow()

    // Then
    expect(result).toEqual(123)
  })

  it('when err result should throw err result', () => {
    // When
    const result = err(new Error('custom error'))

    // Then
    expect(() => result.valueOrThrow()).toThrow(new Error('custom error'))
  })
})

describe('map', () => {
  it('when ok result should return value', () => {
    // When
    const result = err(new Error('Original error')).mapError(() => new Error('Mapped error'))

    // Then
    expect(() => result.valueOrThrow()).toThrow('Mapped error')
  })
})
