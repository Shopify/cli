import {deepMergeObjects, mapValues, pickBy} from './object.js'
import {describe, expect, test} from 'vitest'

describe('deepMergeObjects', () => {
  test('deep merges objects', () => {
    // Given
    const lhs = {name: 'test', list: ['a'], object: {test: 'test'}}
    const rhs = {city: 'berlin', list: ['b'], object: {test2: 'test2'}}

    // When
    const got = deepMergeObjects(lhs, rhs)

    // Then
    expect(got.name).toEqual('test')
    expect(got.city).toEqual('berlin')
    expect(got.list).toEqual(['a', 'b'])
    expect(got.object.test).toEqual('test')
    expect(got.object.test2).toEqual('test2')
  })

  test('deep merges objects with arrays containing matching values', () => {
    // Given
    const lhs = {name: 'test', list: ['a'], object: {test: 'test'}}
    const rhs = {city: 'berlin', list: ['b', 'a'], object: {test2: 'test2'}}

    // When
    const got = deepMergeObjects(lhs, rhs)

    // Then
    expect(got.name).toEqual('test')
    expect(got.city).toEqual('berlin')
    expect(got.list).toEqual(['a', 'b'])
    expect(got.object.test).toEqual('test')
    expect(got.object.test2).toEqual('test2')
  })
})

describe('pickBy', () => {
  test('', () => {
    // Given
    const items = {foo: 'test', bar: 'testtesttest'}

    // When
    const got = pickBy(items, (item) => item.length > 4)

    // Then
    expect(got).toEqual({bar: 'testtesttest'})
  })
})

describe('mapValues', () => {
  test('maps the values of the object', () => {
    // Given
    const users = {
      fred: {user: 'fred', age: 40},
      pebbles: {user: 'pebbles', age: 1},
    }
    // When
    const got = mapValues(users, (item) => {
      return item.age
    })

    // Then
    expect(got).toEqual({fred: 40, pebbles: 1})
  })
})
