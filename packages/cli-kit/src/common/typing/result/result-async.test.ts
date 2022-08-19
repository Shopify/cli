import {errAsync, fromPromise, fromSafePromise, okAsync, ResultAsync} from './result-async.js'
import {err, Err, ok, Ok} from './result.js'
import {describe, expect, it, vitest} from 'vitest'

describe('ResultAsync', () => {
  it('Is awaitable to a Result', async () => {
    // For a success value
    const asyncVal = okAsync(12)
    expect(asyncVal).toBeInstanceOf(ResultAsync)

    const val = await asyncVal

    expect(val).toBeInstanceOf(Ok)
    expect(val._unsafeUnwrap()).toEqual(12)

    // For an error
    const asyncErr = errAsync('Wrong format')
    expect(asyncErr).toBeInstanceOf(ResultAsync)

    const err = await asyncErr

    expect(err).toBeInstanceOf(Err)
    expect(err._unsafeUnwrapErr()).toEqual('Wrong format')
  })

  describe('acting as a Promise<Result>', () => {
    it('Is chainable like any Promise', async () => {
      // For a success value
      const asyncValChained = okAsync(12).then((res) => {
        if (res.isOk()) {
          return res.value + 2
        }
      })

      expect(asyncValChained).toBeInstanceOf(Promise)
      const val = await asyncValChained
      expect(val).toEqual(14)

      // For an error
      const asyncErrChained = errAsync('Oops').then((res) => {
        if (res.isErr()) {
          return `${res.error}!`
        }
      })

      expect(asyncErrChained).toBeInstanceOf(Promise)
      const err = await asyncErrChained
      expect(err).toEqual('Oops!')
    })

    it('Can be used with Promise.all', async () => {
      const allResult = await Promise.all([okAsync<string, Error>('1')])

      expect(allResult).toHaveLength(1)
      expect(allResult[0]).toBeInstanceOf(Ok)
      if (!(allResult[0] instanceof Ok)) return
      expect(allResult[0].isOk()).toBe(true)
      expect(allResult[0]._unsafeUnwrap()).toEqual('1')
    })

    it('rejects if the underlying promise is rejected', () => {
      // eslint-disable-next-line prefer-promise-reject-errors
      const asyncResult = new ResultAsync(Promise.reject('oops'))
      expect(asyncResult).rejects.toBe('oops')
    })
  })

  describe('map', () => {
    it('Maps a value using a synchronous function', async () => {
      const asyncVal = okAsync(12)

      const mapSyncFn = vitest.fn((number) => number.toString())

      const mapped = asyncVal.map(mapSyncFn)

      expect(mapped).toBeInstanceOf(ResultAsync)

      const newVal = await mapped

      expect(newVal.isOk()).toBe(true)
      expect(newVal._unsafeUnwrap()).toBe('12')
      expect(mapSyncFn).toHaveBeenCalledTimes(1)
    })

    it('Maps a value using an asynchronous function', async () => {
      const asyncVal = okAsync(12)

      const mapAsyncFn = vitest.fn((number) => Promise.resolve(number.toString()))

      const mapped = asyncVal.map(mapAsyncFn)

      expect(mapped).toBeInstanceOf(ResultAsync)

      const newVal = await mapped

      expect(newVal.isOk()).toBe(true)
      expect(newVal._unsafeUnwrap()).toBe('12')
      expect(mapAsyncFn).toHaveBeenCalledTimes(1)
    })

    it('Skips an error', async () => {
      const asyncErr = errAsync<number, string>('Wrong format')

      const mapSyncFn = vitest.fn((number) => number.toString())

      const notMapped = asyncErr.map(mapSyncFn)

      expect(notMapped).toBeInstanceOf(ResultAsync)

      const newVal = await notMapped

      expect(newVal.isErr()).toBe(true)
      expect(newVal._unsafeUnwrapErr()).toBe('Wrong format')
      expect(mapSyncFn).toHaveBeenCalledTimes(0)
    })
  })

  describe('mapErr', () => {
    it('Maps an error using a synchronous function', async () => {
      const asyncErr = errAsync('Wrong format')

      const mapErrSyncFn = vitest.fn((str) => `Error: ${str}`)

      const mappedErr = asyncErr.mapErr(mapErrSyncFn)

      expect(mappedErr).toBeInstanceOf(ResultAsync)

      const newVal = await mappedErr

      expect(newVal.isErr()).toBe(true)
      expect(newVal._unsafeUnwrapErr()).toBe('Error: Wrong format')
      expect(mapErrSyncFn).toHaveBeenCalledTimes(1)
    })

    it('Maps an error using an asynchronous function', async () => {
      const asyncErr = errAsync('Wrong format')

      const mapErrAsyncFn = vitest.fn((str) => Promise.resolve(`Error: ${str}`))

      const mappedErr = asyncErr.mapErr(mapErrAsyncFn)

      expect(mappedErr).toBeInstanceOf(ResultAsync)

      const newVal = await mappedErr

      expect(newVal.isErr()).toBe(true)
      expect(newVal._unsafeUnwrapErr()).toBe('Error: Wrong format')
      expect(mapErrAsyncFn).toHaveBeenCalledTimes(1)
    })

    it('Skips a value', async () => {
      const asyncVal = okAsync(12)

      const mapErrSyncFn = vitest.fn((str) => `Error: ${str}`)

      const notMapped = asyncVal.mapErr(mapErrSyncFn)

      expect(notMapped).toBeInstanceOf(ResultAsync)

      const newVal = await notMapped

      expect(newVal.isOk()).toBe(true)
      expect(newVal._unsafeUnwrap()).toBe(12)
      expect(mapErrSyncFn).toHaveBeenCalledTimes(0)
    })
  })

  describe('andThen', () => {
    it('Maps a value using a function returning a ResultAsync', async () => {
      const asyncVal = okAsync(12)

      const andThenResultAsyncFn = vitest.fn(() => okAsync('good'))

      const mapped = asyncVal.andThen(andThenResultAsyncFn)

      expect(mapped).toBeInstanceOf(ResultAsync)

      const newVal = await mapped

      expect(newVal.isOk()).toBe(true)
      expect(newVal._unsafeUnwrap()).toBe('good')
      expect(andThenResultAsyncFn).toHaveBeenCalledTimes(1)
    })

    it('Maps a value using a function returning a Result', async () => {
      const asyncVal = okAsync(12)

      const andThenResultFn = vitest.fn(() => ok('good'))

      const mapped = asyncVal.andThen(andThenResultFn)

      expect(mapped).toBeInstanceOf(ResultAsync)

      const newVal = await mapped

      expect(newVal.isOk()).toBe(true)
      expect(newVal._unsafeUnwrap()).toBe('good')
      expect(andThenResultFn).toHaveBeenCalledTimes(1)
    })

    it('Skips an Error', async () => {
      const asyncVal = errAsync<string, string>('Wrong format')

      const andThenResultFn = vitest.fn(() => ok<string, string>('good'))

      const notMapped = asyncVal.andThen(andThenResultFn)

      expect(notMapped).toBeInstanceOf(ResultAsync)

      const newVal = await notMapped

      expect(newVal.isErr()).toBe(true)
      expect(newVal._unsafeUnwrapErr()).toBe('Wrong format')
      expect(andThenResultFn).toHaveBeenCalledTimes(0)
    })
  })

  describe('orElse', () => {
    it('Skips orElse on an Ok value', async () => {
      const okVal = okAsync(12)
      const errorCallback = vitest.fn((_errVal) => errAsync<number, string>('It is now a string'))

      const result = await okVal.orElse(errorCallback)

      expect(result).toEqual(ok(12))

      expect(errorCallback).not.toHaveBeenCalled()
    })

    it('Invokes the orElse callback on an Err value', async () => {
      const myResult = errAsync('BOOOM!')
      const errorCallback = vitest.fn((_errVal) => errAsync(true))

      const result = await myResult.orElse(errorCallback)

      expect(result).toEqual(err(true))
      expect(errorCallback).toHaveBeenCalledTimes(1)
    })

    it('Accepts a regular Result in the callback', async () => {
      const myResult = errAsync('BOOOM!')
      const errorCallback = vitest.fn((_errVal) => err(true))

      const result = await myResult.orElse(errorCallback)

      expect(result).toEqual(err(true))
      expect(errorCallback).toHaveBeenCalledTimes(1)
    })
  })

  describe('match', () => {
    it('Matches on an Ok', async () => {
      const okMapper = vitest.fn((_val) => 'weeeeee')
      const errMapper = vitest.fn((_val) => 'wooooo')

      const matched = await okAsync(12).match(okMapper, errMapper)

      expect(matched).toBe('weeeeee')
      expect(okMapper).toHaveBeenCalledTimes(1)
      expect(errMapper).not.toHaveBeenCalled()
    })

    it('Matches on an Error', async () => {
      const okMapper = vitest.fn((_val) => 'weeeeee')
      const errMapper = vitest.fn((_val) => 'wooooo')

      const matched = await errAsync('bad').match(okMapper, errMapper)

      expect(matched).toBe('wooooo')
      expect(okMapper).not.toHaveBeenCalled()
      expect(errMapper).toHaveBeenCalledTimes(1)
    })
  })

  describe('unwrapOr', () => {
    it('returns a promise to the result value on an Ok', async () => {
      const unwrapped = await okAsync(12).unwrapOr(10)
      expect(unwrapped).toBe(12)
    })

    it('returns a promise to the provided default value on an Error', async () => {
      const unwrapped = await errAsync<number, number>(12).unwrapOr(10)
      expect(unwrapped).toBe(10)
    })
  })

  describe('unwrapOrThrow', () => {
    it('returns a promise to the result value on an Ok', async () => {
      const unwrapped = await okAsync(12).unwrapOrThrow()
      await expect(unwrapped).toBe(12)
    })

    it('throws an exception on an Error', async () => {
      await expect(errAsync<number, Error>(new Error('Error message')).unwrapOrThrow()).rejects.toThrowError(
        'Error message',
      )
    })
  })

  describe('fromSafePromise', () => {
    it('Creates a ResultAsync from a Promise', async () => {
      const res = ResultAsync.fromSafePromise(Promise.resolve(12))

      expect(res).toBeInstanceOf(ResultAsync)

      const val = await res
      expect(val.isOk()).toBe(true)
      expect(val._unsafeUnwrap()).toEqual(12)
    })

    it('has a top level export', () => {
      expect(fromSafePromise).toBe(ResultAsync.fromSafePromise)
    })
  })

  describe('fromPromise', () => {
    it('Accepts an error handler as a second argument', async () => {
      // eslint-disable-next-line prefer-promise-reject-errors
      const res = ResultAsync.fromPromise(Promise.reject('No!'), (err) => new Error(`Oops: ${err}`))

      expect(res).toBeInstanceOf(ResultAsync)

      const val = await res
      expect(val.isErr()).toBe(true)
      expect(val._unsafeUnwrapErr()).toEqual(Error('Oops: No!'))
    })

    it('has a top level export', () => {
      expect(fromPromise).toBe(ResultAsync.fromPromise)
    })
  })

  describe('okAsync', () => {
    it('Creates a ResultAsync that resolves to an Ok', async () => {
      const val = okAsync(12)

      expect(val).toBeInstanceOf(ResultAsync)

      const res = await val

      expect(res.isOk()).toBe(true)
      expect(res._unsafeUnwrap()).toEqual(12)
    })
  })

  describe('errAsync', () => {
    it('Creates a ResultAsync that resolves to an Err', async () => {
      const err = errAsync('bad')

      expect(err).toBeInstanceOf(ResultAsync)

      const res = await err

      expect(res.isErr()).toBe(true)
      expect(res._unsafeUnwrapErr()).toEqual('bad')
    })
  })
})
