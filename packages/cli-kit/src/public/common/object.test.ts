import {
  deepCompare,
  deepDifference,
  deepMergeObjects,
  flattenAndCompareObjects,
  flattenObjectToKeyPathsWithValues,
  mapValues,
  pickBy,
} from './object.js'
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

describe('deepCompare', () => {
  test('returns true if two objects are identical', () => {
    // Given
    const obj1: object = {
      key1: 1,
      key2: {
        subkey1: 1,
      },
    }

    // When
    const result = deepCompare(obj1, obj1)

    // Then
    expect(result).toBeTruthy()
  })

  test('returns false if the objects are different', () => {
    // Given
    const obj1: object = {
      key1: 1,
      key2: {
        subkey1: 1,
      },
    }

    const obj2: object = {
      key1: 1,
      key2: {
        subkey1: 2,
      },
    }

    // When
    const result = deepCompare(obj1, obj2)

    // Then
    expect(result).toBeFalsy()
  })
})

describe('deepDifference', () => {
  test('returns the difference between two objects', () => {
    // Given
    const obj1 = {
      key1: 1,
      key2: {
        subkey1: 1,
        nestedIdentical: 'same',
      },
      differentTopLevel: 'obj1',
      onlyInOneObject: 'only',
      inOneButOtherUndefined: 'is set',
      deepIdentical: {
        foo: {
          bar: {
            baz: 'deep',
          },
        },
      },
      deepDifferent: {
        foo: {
          bar: {
            baz: 'obj1',
            same: 'same',
          },
          same: 'same',
        },
        same: 'same',
      },
      sameList: [1, 2, 3],
      diffList: [1, 2, 'diff1'],
      listOfObjects: [{same: 'same'}, {diff: 'diff1'}],
    }

    const obj2 = {
      key1: 1,
      key2: {
        subkey1: 2,
        nestedIdentical: 'same',
      },
      differentTopLevel: 'obj2',
      inOneButOtherUndefined: undefined,
      deepIdentical: {
        foo: {
          bar: {
            baz: 'deep',
          },
        },
      },
      deepDifferent: {
        foo: {
          bar: {
            baz: 'obj2',
            same: 'same',
          },
          same: 'same',
        },
        same: 'same',
      },
      sameList: [1, 2, 3],
      diffList: [1, 2, 'diff2'],
      listOfObjects: [{same: 'same'}, {diff: 'diff2'}],
    }

    // When
    const result = deepDifference(obj1, obj2)

    // Then
    expect(result).toEqual([
      {
        key2: {subkey1: 1, nestedIdentical: 'same'},
        differentTopLevel: 'obj1',
        onlyInOneObject: 'only',
        inOneButOtherUndefined: 'is set',
        deepDifferent: {
          foo: {
            bar: {
              baz: 'obj1',
              same: 'same',
            },
            same: 'same',
          },
          same: 'same',
        },
        diffList: [1, 2, 'diff1'],
        listOfObjects: [{same: 'same'}, {diff: 'diff1'}],
      },
      {
        key2: {subkey1: 2, nestedIdentical: 'same'},
        differentTopLevel: 'obj2',
        inOneButOtherUndefined: undefined,
        deepDifferent: {
          foo: {
            bar: {
              baz: 'obj2',
              same: 'same',
            },
            same: 'same',
          },
          same: 'same',
        },
        diffList: [1, 2, 'diff2'],
        listOfObjects: [{same: 'same'}, {diff: 'diff2'}],
      },
    ])
  })
})

describe('flattenObjectToKeyPathsWithValues', () => {
  test('flattens an interesting object', () => {
    // Given
    const input = {
      topLevel: 1,
      nestedObject: {
        inside: 2,
      },
      anArray: [0, 1, 2],
      anArrayWithObject: [{foo: 'bar'}, {abc: 'xyz'}],
    }

    // When
    const result = flattenObjectToKeyPathsWithValues(input)

    // Then
    expect(result).toEqual([
      ['anArray.0', 0],
      ['anArray.1', 1],
      ['anArray.2', 2],
      ['anArrayWithObject.0.foo', 'bar'],
      ['anArrayWithObject.1.abc', 'xyz'],
      ['nestedObject.inside', 2],
      ['topLevel', 1],
    ])
  })
})

describe('flattenAndCompareObjects', () => {
  test('shows differences between two objects', () => {
    // Given
    const one = {
      inBoth: 'same',
      different: 'one',
      onlyInOne: 'one',
      nested: {
        same: 'same',
        diff: 'one',
      },
      array: ['same', 'one', 'same'],
    }
    const two = {
      inBoth: 'same',
      different: 'two',
      nested: {
        same: 'same',
        diff: 'two',
      },
      array: ['same', 'two', 'same'],
    }

    // When
    const result = flattenAndCompareObjects(one, two)

    // Then
    expect(result).toEqual([
      ['array.1', 'one', 'two'],
      ['different', 'one', 'two'],
      ['nested.diff', 'one', 'two'],
      ['onlyInOne', 'one', undefined],
    ])
  })
})
