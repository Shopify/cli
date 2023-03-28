import {err, ok} from './result.js'
import {mockAndCaptureOutput} from './testing/output.js'
import {outputSuccess} from '../../public/node/output.js'
import {describe, expect, test} from 'vitest'

describe('ok', () => {
  test('create ok with value', () => {
    // When
    const result = ok(123)

    // Then
    expect(!result.isErr() && result.value).toEqual(123)
  })
})

describe('err', () => {
  test('create err with en Error', () => {
    // When
    const result = err(new Error('Custom error object'))

    // Then
    expect(result.isErr() && result.error).toEqual(new Error('Custom error object'))
  })
})

describe('valueOrBug', () => {
  test('when ok result should return value', () => {
    // When
    const result = ok(123).valueOrBug()

    // Then
    expect(result).toEqual(123)
  })

  test('when err result should throw err result', () => {
    // When
    const result = err(new Error('custom error'))

    // Then
    expect(() => result.valueOrBug()).toThrow(new Error('custom error'))
  })
})

describe('mapError', () => {
  test('when ok result should not affect the result', () => {
    // When
    const result = ok('value').mapError(() => new Error('Mapped error'))

    // Then
    expect(!result.isErr() && result.value).toEqual('value')
  })

  test('when error result should return mapped error', () => {
    // When
    const result = err(new Error('Original error')).mapError(() => new Error('Mapped error'))

    // Then
    expect(() => result.valueOrBug()).toThrow('Mapped error')
  })
})

describe('doOnOk', () => {
  test('when ok result should execute the command and continue', () => {
    // Given
    const outpuMocker = mockAndCaptureOutput()

    // When
    const result = ok(123).doOnOk((value) => outputSuccess(`result ok ${value}`))

    // Then
    expect(!result.isErr() && result.value).toEqual(123)
    expect(outpuMocker.success()).toMatchInlineSnapshot('"result ok 123"')
  })
})

describe('map', () => {
  test('when ok result should return mapped value', () => {
    // When
    const result = ok('value').map(() => 'mapped value')

    // Then
    expect(!result.isErr() && result.value).toEqual('mapped value')
  })

  test('when error result should not affect the result', () => {
    // When
    const result = err(new Error('Original error')).map(() => 'mapped value')

    // Then
    expect(() => result.valueOrBug()).toThrow('Original error')
  })
})
