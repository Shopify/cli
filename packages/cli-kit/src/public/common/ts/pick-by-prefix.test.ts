import {PickByPrefix} from './pick-by-prefix.js'
import {describe, expectTypeOf, test} from 'vitest'

describe('PickByPrefix', () => {
  test('picks keys matching a prefix', () => {
    interface Source {
      foo_one: number
      foo_two: string
      bar_one: boolean
    }

    type Result = PickByPrefix<Source, 'foo_'>

    expectTypeOf<Result>().toEqualTypeOf<{
      foo_one: number
      foo_two: string
    }>()
  })

  test('picks keys matching a prefix and explicitly included keys', () => {
    interface Source {
      foo_one: number
      foo_two: string
      bar_one: boolean
      extra: string
    }

    type Result = PickByPrefix<Source, 'foo_', 'extra'>

    expectTypeOf<Result>().toEqualTypeOf<{
      foo_one: number
      foo_two: string
      extra: string
    }>()
  })

  test('returns empty object type when no keys match prefix or extra keys', () => {
    interface Source {
      bar_one: boolean
      baz_two: number
    }

    type Result = PickByPrefix<Source, 'foo_'>

    expectTypeOf<Result>().toEqualTypeOf<{}>()
  })
})
