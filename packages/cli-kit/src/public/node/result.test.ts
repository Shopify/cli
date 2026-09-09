import {err, ok} from './result.js'
import {mockAndCaptureOutput} from './testing/output.js'
import {outputSuccess} from './output.js'
import {AbortError, BugError} from './error.js'
import {describe, expect, test, vi} from 'vitest'

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

describe('valueOrAbort', () => {
  test('when ok result should return value', () => {
    // When
    const result = ok(123).valueOrAbort()

    // Then
    expect(result).toEqual(123)
  })

  test('when err result with FatalError should throw the original FatalError', () => {
    // Given
    const fatal = new BugError('fatal bug')

    // When / Then
    expect(() => err(fatal).valueOrAbort()).toThrow(fatal)
  })

  test('when err result with standard Error should throw AbortError with matching message and stack', () => {
    // Given
    const standardError = new Error('standard error')
    standardError.stack = 'custom stack trace'

    // When / Then
    try {
      err(standardError).valueOrAbort()
      expect.fail('Expected valueOrAbort to throw')
    } catch (error) {
      if (error instanceof AbortError) {
        expect(error.message).toEqual('standard error')
        expect(error.stack).toEqual('custom stack trace')
      } else {
        throw error
      }
    }
  })

  test('when err result with non-Error value should throw AbortError with string representation', () => {
    // When / Then
    expect(() => err('string error').valueOrAbort()).toThrow(new AbortError('string error'))
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

  test('when err result should not execute the command and return err', () => {
    // Given
    const handler = vi.fn()

    // When
    const result = err(new Error('error')).doOnOk(handler)

    // Then
    expect(handler).not.toHaveBeenCalled()
    expect(result.isErr() && result.error).toEqual(new Error('error'))
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
