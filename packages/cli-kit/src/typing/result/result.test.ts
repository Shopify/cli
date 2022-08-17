import {Err, err, fromThrowable, Ok, ok, Result} from './result.js'
import {okAsync, ResultAsync} from './result-async.js'
import {describe, expect, it, vitest} from 'vitest'

describe('Result.Ok', () => {
  it('Creates an Ok value', () => {
    const okVal = ok(12)

    expect(okVal.isOk()).toBe(true)
    expect(okVal.isErr()).toBe(false)
    expect(okVal).toBeInstanceOf(Ok)
  })

  it('Creates an Ok value with null', () => {
    const okVal = ok(null)

    expect(okVal.isOk()).toBe(true)
    expect(okVal.isErr()).toBe(false)
    expect(okVal._unsafeUnwrap()).toBe(null)
  })

  it('Creates an Ok value with undefined', () => {
    const okVal = ok(undefined)

    expect(okVal.isOk()).toBe(true)
    expect(okVal.isErr()).toBe(false)
    expect(okVal._unsafeUnwrap()).toBeUndefined()
  })

  it('Is comparable', () => {
    expect(ok(42)).toEqual(ok(42))
    expect(ok(42)).not.toEqual(ok(43))
  })

  it('Maps over an Ok value', () => {
    const okVal = ok(12)
    const mapFn = vitest.fn((number) => number.toString())

    const mapped = okVal.map(mapFn)

    expect(mapped.isOk()).toBe(true)
    expect(mapped._unsafeUnwrap()).toBe('12')
    expect(mapFn).toHaveBeenCalledTimes(1)
  })

  it('Skips `mapErr`', () => {
    // eslint-disable-next-line node/handle-callback-err
    const mapErrorFunc = vitest.fn((_error) => 'mapped error value')

    const notMapped = ok(12).mapErr(mapErrorFunc)

    expect(notMapped.isOk()).toBe(true)
    expect(mapErrorFunc).not.toHaveBeenCalledTimes(1)
  })

  describe('andThen', () => {
    it('Maps to an Ok', () => {
      const okVal = ok(12)

      const flattened = okVal.andThen((_number) => {
        // ...
        // complex logic
        // ...
        return ok({data: 'why not'})
      })

      expect(flattened.isOk()).toBe(true)
      expect(flattened._unsafeUnwrap()).toStrictEqual({data: 'why not'})
    })

    it('Maps to an Err', () => {
      const okval = ok(12)

      const flattened = okval.andThen((_number) => {
        // ...
        // complex logic
        // ...
        return err('Whoopsies!')
      })

      expect(flattened.isOk()).toBe(false)

      const nextFn = vitest.fn((_val) => ok('noop'))

      flattened.andThen(nextFn)

      expect(nextFn).not.toHaveBeenCalled()
    })
  })

  describe('orElse', () => {
    it('Skips orElse on an Ok value', () => {
      const okVal = ok(12)
      const errorCallback = vitest.fn((_errVal) => err<number, string>('It is now a string'))

      expect(okVal.orElse(errorCallback)).toEqual(ok(12))
      expect(errorCallback).not.toHaveBeenCalled()
    })
  })

  it('unwrapOr and return the Ok value', () => {
    const okVal = ok(12)
    expect(okVal.unwrapOr(1)).toEqual(12)
  })

  it('Maps to a ResultAsync', async () => {
    const okVal = ok(12)

    const flattened = okVal.asyncAndThen((_number) => {
      // ...
      // complex async logic
      // ...
      return okAsync({data: 'why not'})
    })

    expect(flattened).toBeInstanceOf(ResultAsync)

    const newResult = await flattened

    expect(newResult.isOk()).toBe(true)
    expect(newResult._unsafeUnwrap()).toStrictEqual({data: 'why not'})
  })

  it('Maps to a promise', async () => {
    const asyncMapper = vitest.fn((_val) => {
      // ...
      // complex logic
      // ..

      // db queries
      // network calls
      // disk io
      // etc ...
      return Promise.resolve(ok('Very Nice!'))
    })

    const okVal = ok(12)

    const promise = okVal.asyncMap(asyncMapper)

    expect(promise).toBeInstanceOf(ResultAsync)

    const newResult = await promise

    expect(newResult.isOk()).toBe(true)
    expect(asyncMapper).toHaveBeenCalledTimes(1)
  })

  it('Matches on an Ok', () => {
    const okMapper = vitest.fn((_val) => 'weeeeee')
    const errMapper = vitest.fn((_val) => 'wooooo')

    const matched = ok(12).match(okMapper, errMapper)

    expect(matched).toBe('weeeeee')
    expect(okMapper).toHaveBeenCalledTimes(1)
    expect(errMapper).not.toHaveBeenCalled()
  })

  it('Unwraps without issue', () => {
    const okVal = ok(12)

    expect(okVal._unsafeUnwrap()).toBe(12)
  })

  it('Can read the value after narrowing', () => {
    const fallible: () => Result<string, number> = () => ok('safe to read')
    const val = fallible()

    // After this check we val is narrowed to Ok<string, number>. Without this
    // line TypeScript will not allow accessing val.value.
    if (val.isErr()) return

    expect(val.value).toBe('safe to read')
  })
})

describe('Result.Err', () => {
  it('Creates an Err value', () => {
    const errVal = err('I have you now.')

    expect(errVal.isOk()).toBe(false)
    expect(errVal.isErr()).toBe(true)
    expect(errVal).toBeInstanceOf(Err)
  })

  it('Is comparable', () => {
    expect(err(42)).toEqual(err(42))
    expect(err(42)).not.toEqual(err(43))
  })

  it('Skips `map`', () => {
    const errVal = err('I am your father')

    const mapper = vitest.fn((_value) => 'noooo')

    const hopefullyNotMapped = errVal.map(mapper)

    expect(hopefullyNotMapped.isErr()).toBe(true)
    expect(mapper).not.toHaveBeenCalled()
    expect(hopefullyNotMapped._unsafeUnwrapErr()).toEqual(errVal._unsafeUnwrapErr())
  })

  it('Maps over an Err', () => {
    const errVal = err('Round 1, Fight!')

    const mapper = vitest.fn((error: string) => error.replace('1', '2'))

    const mapped = errVal.mapErr(mapper)

    expect(mapped.isErr()).toBe(true)
    expect(mapper).toHaveBeenCalledTimes(1)
    expect(mapped._unsafeUnwrapErr()).not.toEqual(errVal._unsafeUnwrapErr())
  })

  it('unwrapOr and return the default value', () => {
    const okVal = err<number, string>('Oh nooo')
    expect(okVal.unwrapOr(1)).toEqual(1)
  })

  it('Skips over andThen', () => {
    const errVal = err('Yolo')

    const mapper = vitest.fn((_val) => ok<string, string>('yooyo'))

    const hopefullyNotFlattened = errVal.andThen(mapper)

    expect(hopefullyNotFlattened.isErr()).toBe(true)
    expect(mapper).not.toHaveBeenCalled()
    expect(errVal._unsafeUnwrapErr()).toEqual('Yolo')
  })

  it('Transforms error into ResultAsync within `asyncAndThen`', async () => {
    const errVal = err('Yolo')

    const asyncMapper = vitest.fn((_val) => okAsync<string, string>('yooyo'))

    const hopefullyNotFlattened = errVal.asyncAndThen(asyncMapper)

    expect(hopefullyNotFlattened).toBeInstanceOf(ResultAsync)
    expect(asyncMapper).not.toHaveBeenCalled()

    const syncResult = await hopefullyNotFlattened
    expect(syncResult._unsafeUnwrapErr()).toEqual('Yolo')
  })

  it('Does not invoke callback within `asyncMap`', async () => {
    const asyncMapper = vitest.fn((_val) => {
      // ...
      // complex logic
      // ..

      // db queries
      // network calls
      // disk io
      // etc ...
      return Promise.resolve(ok('Very Nice!'))
    })

    const errVal = err('nooooooo')

    const promise = errVal.asyncMap(asyncMapper)

    expect(promise).toBeInstanceOf(ResultAsync)

    const sameResult = await promise

    expect(sameResult.isErr()).toBe(true)
    expect(asyncMapper).not.toHaveBeenCalled()
    expect(sameResult._unsafeUnwrapErr()).toEqual(errVal._unsafeUnwrapErr())
  })

  it('Matches on an Err', () => {
    const okMapper = vitest.fn((_val) => 'weeeeee')
    const errMapper = vitest.fn((_val) => 'wooooo')

    const matched = err(12).match(okMapper, errMapper)

    expect(matched).toBe('wooooo')
    expect(okMapper).not.toHaveBeenCalled()
    expect(errMapper).toHaveBeenCalledTimes(1)
  })

  it('Throws when you unwrap an Err', () => {
    const errVal = err('woopsies')

    expect(() => {
      errVal._unsafeUnwrap()
    }).toThrowError()
  })

  it('Unwraps without issue', () => {
    const okVal = err(12)

    expect(okVal._unsafeUnwrapErr()).toBe(12)
  })

  describe('orElse', () => {
    it('invokes the orElse callback on an Err value', () => {
      const okVal = err('BOOOM!')
      const errorCallback = vitest.fn((_errVal) => err(true))

      expect(okVal.orElse(errorCallback)).toEqual(err(true))
      expect(errorCallback).toHaveBeenCalledTimes(1)
    })
  })
})

describe('Result.fromThrowable', () => {
  it('Creates a function that returns an OK result when the inner function does not throw', () => {
    const hello = (): string => 'hello'
    const safeHello = Result.fromThrowable(hello)

    const result = hello()
    const safeResult = safeHello()

    expect(safeResult).toBeInstanceOf(Ok)
    expect(result).toEqual(safeResult._unsafeUnwrap())
  })

  // Added for issue #300 -- the test here is not so much that expectations are met as that the test compiles.
  it('Accepts an inner function which takes arguments', () => {
    const hello = (fname: string): string => `hello, ${fname}`
    const safeHello = Result.fromThrowable(hello)

    const result = hello('Dikembe')
    const safeResult = safeHello('Dikembe')

    expect(safeResult).toBeInstanceOf(Ok)
    expect(result).toEqual(safeResult._unsafeUnwrap())
  })

  it('Creates a function that returns an err when the inner function throws', () => {
    const thrower = (): string => {
      throw new Error()
    }

    // type: () => Result<string, unknown>
    // received types from thrower fn, no errorFn is provides therefore Err type is unknown
    const safeThrower = Result.fromThrowable(thrower)
    const result = safeThrower()

    expect(result).toBeInstanceOf(Err)
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(Error)
  })

  it('Accepts an error handler as a second argument', () => {
    const thrower = (): string => {
      throw new Error()
    }
    interface MessageObject {
      message: string
    }
    const toMessageObject = (): MessageObject => ({message: 'error'})

    // type: () => Result<string, MessageObject>
    // received types from thrower fn and errorFn return type
    const safeThrower = Result.fromThrowable(thrower, toMessageObject)
    const result = safeThrower()

    expect(result.isOk()).toBe(false)
    expect(result.isErr()).toBe(true)
    expect(result).toBeInstanceOf(Err)
    expect(result._unsafeUnwrapErr()).toEqual({message: 'error'})
  })

  it('has a top level export', () => {
    expect(fromThrowable).toBe(Result.fromThrowable)
  })
})
