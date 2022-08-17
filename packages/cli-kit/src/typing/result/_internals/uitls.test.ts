import {err, ok, Result} from '../result.js'
import {errAsync, okAsync, ResultAsync} from '../result-async.js'
import {describe, expect, it} from 'vitest'

describe('Utils', () => {
  describe('`Result.combine`', () => {
    describe('Synchronous `combine`', () => {
      it('Combines a list of results into an Ok value', () => {
        const resultList = [ok(123), ok(456), ok(789)]

        const result = Result.combine(resultList)

        expect(result.isOk()).toBe(true)
        expect(result._unsafeUnwrap()).toEqual([123, 456, 789])
      })

      it('Combines a list of results into an Err value', () => {
        const resultList: Result<number, string>[] = [ok(123), err('boooom!'), ok(456), err('ahhhhh!')]

        const result = Result.combine(resultList)

        expect(result.isErr()).toBe(true)
        expect(result._unsafeUnwrapErr()).toBe('boooom!')
      })

      it('Combines heterogeneous lists', () => {
        type HeterogenousList = [Result<string, string>, Result<number, number>, Result<boolean, boolean>]

        const heterogenousList: HeterogenousList = [ok('Yooooo'), ok(123), ok(true)]

        type ExpecteResult = Result<[string, number, boolean], string | number | boolean>

        const result: ExpecteResult = Result.combine(heterogenousList)

        expect(result._unsafeUnwrap()).toEqual(['Yooooo', 123, true])
      })

      it('Does not destructure / concatenate arrays', () => {
        type HomogenousList = [Result<string[], boolean>, Result<number[], string>]

        const homogenousList: HomogenousList = [ok(['hello', 'world']), ok([1, 2, 3])]

        type ExpectedResult = Result<[string[], number[]], boolean | string>

        const result: ExpectedResult = Result.combine(homogenousList)

        expect(result._unsafeUnwrap()).toEqual([
          ['hello', 'world'],
          [1, 2, 3],
        ])
      })
    })

    describe('`ResultAsync.combine`', () => {
      it('Combines a list of async results into an Ok value', async () => {
        const asyncResultList = [okAsync(123), okAsync(456), okAsync(789)]

        const resultAsync: ResultAsync<number[], unknown> = ResultAsync.combine(asyncResultList)

        expect(resultAsync).toBeInstanceOf(ResultAsync)

        const result = await ResultAsync.combine(asyncResultList)

        expect(result.isOk()).toBe(true)
        expect(result._unsafeUnwrap()).toEqual([123, 456, 789])
      })

      it('Combines a list of results into an Err value', async () => {
        const resultList: ResultAsync<number, string>[] = [
          okAsync(123),
          errAsync('boooom!'),
          okAsync(456),
          errAsync('ahhhhh!'),
        ]

        const result = await ResultAsync.combine(resultList)

        expect(result.isErr()).toBe(true)
        expect(result._unsafeUnwrapErr()).toBe('boooom!')
      })

      it('Combines heterogeneous lists', async () => {
        type HeterogenousList = [
          ResultAsync<string, string>,
          ResultAsync<number, number>,
          ResultAsync<boolean, boolean>,
          ResultAsync<number[], string>,
        ]

        const heterogenousList: HeterogenousList = [okAsync('Yooooo'), okAsync(123), okAsync(true), okAsync([1, 2, 3])]

        type ExpecteResult = Result<[string, number, boolean, number[]], string | number | boolean>

        const result: ExpecteResult = await ResultAsync.combine(heterogenousList)

        expect(result._unsafeUnwrap()).toEqual(['Yooooo', 123, true, [1, 2, 3]])
      })
    })
  })
  describe('`Result.combineWithAllErrors`', () => {
    describe('Synchronous `combineWithAllErrors`', () => {
      it('Combines a list of results into an Ok value', () => {
        const resultList = [ok(123), ok(456), ok(789)]

        const result = Result.combineWithAllErrors(resultList)

        expect(result.isOk()).toBe(true)
        expect(result._unsafeUnwrap()).toEqual([123, 456, 789])
      })

      it('Combines a list of results into an Err value', () => {
        const resultList: Result<number, string>[] = [ok(123), err('boooom!'), ok(456), err('ahhhhh!')]

        const result = Result.combineWithAllErrors(resultList)

        expect(result.isErr()).toBe(true)
        expect(result._unsafeUnwrapErr()).toEqual(['boooom!', 'ahhhhh!'])
      })

      it('Combines heterogeneous lists', () => {
        type HeterogenousList = [Result<string, string>, Result<number, number>, Result<boolean, boolean>]

        const heterogenousList: HeterogenousList = [ok('Yooooo'), ok(123), ok(true)]

        type ExpecteResult = Result<[string, number, boolean], (string | number | boolean)[]>

        const result: ExpecteResult = Result.combineWithAllErrors(heterogenousList)

        expect(result._unsafeUnwrap()).toEqual(['Yooooo', 123, true])
      })

      it('Does not destructure / concatenate arrays', () => {
        type HomogenousList = [Result<string[], boolean>, Result<number[], string>]

        const homogenousList: HomogenousList = [ok(['hello', 'world']), ok([1, 2, 3])]

        type ExpectedResult = Result<[string[], number[]], (boolean | string)[]>

        const result: ExpectedResult = Result.combineWithAllErrors(homogenousList)

        expect(result._unsafeUnwrap()).toEqual([
          ['hello', 'world'],
          [1, 2, 3],
        ])
      })
    })
    describe('`ResultAsync.combineWithAllErrors`', () => {
      it('Combines a list of async results into an Ok value', async () => {
        const asyncResultList = [okAsync(123), okAsync(456), okAsync(789)]

        const result = await ResultAsync.combineWithAllErrors(asyncResultList)

        expect(result.isOk()).toBe(true)
        expect(result._unsafeUnwrap()).toEqual([123, 456, 789])
      })

      it('Combines a list of results into an Err value', async () => {
        const asyncResultList: ResultAsync<number, string>[] = [
          okAsync(123),
          errAsync('boooom!'),
          okAsync(456),
          errAsync('ahhhhh!'),
        ]

        const result = await ResultAsync.combineWithAllErrors(asyncResultList)

        expect(result.isErr()).toBe(true)
        expect(result._unsafeUnwrapErr()).toEqual(['boooom!', 'ahhhhh!'])
      })

      it('Combines heterogeneous lists', async () => {
        type HeterogenousList = [
          ResultAsync<string, string>,
          ResultAsync<number, number>,
          ResultAsync<boolean, boolean>,
        ]

        const heterogenousList: HeterogenousList = [okAsync('Yooooo'), okAsync(123), okAsync(true)]

        type ExpecteResult = Result<[string, number, boolean], (string | number | boolean)[]>

        const result: ExpecteResult = await ResultAsync.combineWithAllErrors(heterogenousList)

        expect(result._unsafeUnwrap()).toEqual(['Yooooo', 123, true])
      })
    })
  })
})
