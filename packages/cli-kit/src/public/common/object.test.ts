import {deepMergeObjects} from './object.js'
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
