import {err, ok} from './result.js'
import {mockAndCaptureOutput} from '../../testing/output.js'
import {success} from '../../output.js'
import {describe, expect, it} from 'vitest'

describe('ok', () => {
  it('create ok with value', () => {
    // When
    const result = ok(123)

    // Then
    expect(!result.isErr() && result.value).toEqual(123)
  })
})

describe('err', () => {
  it('create err with en Error', () => {
    // When
    const result = err(new Error('Custom error object'))

    // Then
    expect(result.isErr() && result.error).toEqual(new Error('Custom error object'))
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

describe('mapError', () => {
  it('when ok result should not affect the result', () => {
    // When
    const result = ok('value').mapError(() => new Error('Mapped error'))

    // Then
    expect(!result.isErr() && result.value).toEqual('value')
  })

  it('when error result should return mapped error', () => {
    // When
    const result = err(new Error('Original error')).mapError(() => new Error('Mapped error'))

    // Then
    expect(() => result.valueOrThrow()).toThrow('Mapped error')
  })
})

describe('doOnOk', () => {
  it('when ok result should execute the command and continue', () => {
    // Given
    const outpuMocker = mockAndCaptureOutput()

    // When
    const result = ok(123).doOnOk((value) => success(`result ok ${value}`))

    // Then
    expect(!result.isErr() && result.value).toEqual(123)
    expect(outpuMocker.success()).toMatchInlineSnapshot('"result ok 123"')
  })
})

describe('map', () => {
  it('when ok result should return mapped value', () => {
    // When
    const result = ok('value').map(() => 'mapped value')

    // Then
    expect(!result.isErr() && result.value).toEqual('mapped value')
  })

  it('when error result should not affect the result', () => {
    // When
    const result = err(new Error('Original error')).map(() => 'mapped value')

    // Then
    expect(() => result.valueOrThrow()).toThrow('Original error')
  })
})
