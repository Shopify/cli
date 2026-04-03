import camelcaseKeys from './camelcase-keys.js'
import {describe, expect, test} from 'vitest'

describe('camelcaseKeys', () => {
  test('converts snake_case keys', () => {
    expect(camelcaseKeys({foo_bar: 1, baz_qux: 2})).toEqual({fooBar: 1, bazQux: 2})
  })

  test('converts kebab-case keys', () => {
    expect(camelcaseKeys({'foo-bar': 1, 'baz-qux': 2})).toEqual({fooBar: 1, bazQux: 2})
  })

  test('leaves camelCase keys unchanged', () => {
    expect(camelcaseKeys({alreadyCamel: 1})).toEqual({alreadyCamel: 1})
  })

  test('handles null and undefined values', () => {
    expect(camelcaseKeys({foo_bar: null, baz_qux: undefined})).toEqual({fooBar: null, bazQux: undefined})
  })

  test('handles arrays at top level', () => {
    expect(camelcaseKeys([{foo_bar: 1}])).toEqual([{foo_bar: 1}])
  })

  test('does not recurse by default', () => {
    expect(camelcaseKeys({foo_bar: {nested_key: 1}})).toEqual({fooBar: {nested_key: 1}})
  })

  test('recurses with deep: true', () => {
    expect(camelcaseKeys({foo_bar: {nested_key: 1}}, {deep: true})).toEqual({fooBar: {nestedKey: 1}})
  })

  test('recurses into arrays with deep: true', () => {
    expect(camelcaseKeys({arr: [{nested_key: 1}]}, {deep: true})).toEqual({arr: [{nestedKey: 1}]})
  })

  test('handles top-level arrays with deep: true', () => {
    expect(camelcaseKeys([{foo_bar: 1}], {deep: true})).toEqual([{fooBar: 1}])
  })

  test('returns primitives unchanged', () => {
    expect(camelcaseKeys(null as any)).toBeNull()
    expect(camelcaseKeys('hello' as any)).toBe('hello')
  })

  test('strips leading underscores', () => {
    expect(camelcaseKeys({_private: 1})).toEqual({private: 1})
    expect(camelcaseKeys({_foo_bar: 1})).toEqual({fooBar: 1})
  })

  test('handles consecutive underscores', () => {
    expect(camelcaseKeys({foo__bar: 1})).toEqual({fooBar: 1})
    expect(camelcaseKeys({foo___bar: 1})).toEqual({fooBar: 1})
  })

  test('handles ALL_CAPS keys', () => {
    expect(camelcaseKeys({ALL_CAPS: 1})).toEqual({allCaps: 1})
  })

  test('handles empty object', () => {
    expect(camelcaseKeys({})).toEqual({})
  })

  test('preserves Date values with deep: true', () => {
    const date = new Date('2024-01-01')
    const result = camelcaseKeys({created_at: date}, {deep: true})
    expect(result).toEqual({createdAt: date})
  })

  test('does not recurse into Date objects with deep: true', () => {
    const date = new Date('2024-01-01')
    const result: Record<string, unknown> = camelcaseKeys({foo_bar: date}, {deep: true})
    expect(result.fooBar).toBeInstanceOf(Date)
  })
})
