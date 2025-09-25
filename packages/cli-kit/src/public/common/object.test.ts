import {
  compact,
  deepCompare,
  deepDifference,
  deepMergeObjects,
  getPathValue,
  mapValues,
  pickBy,
  setPathValue,
  unsetPathValue,
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
    const result = deepDifference(obj1, obj2)

    // Then
    expect(result).toEqual([{key2: {subkey1: 1}}, {key2: {subkey1: 2}}])
  })
})

describe('getPathValue', () => {
  test('returns the path value at the top level if it exists', () => {
    // Given
    const obj: object = {
      key1: 1,
    }

    // When
    const result = getPathValue(obj, 'key1')

    // Then
    expect(result).toEqual(1)
  })

  test('returns the path value inside a nested object if it exists', () => {
    // Given
    const obj: object = {
      key1: {
        key11: 2,
      },
    }

    // When
    const result = getPathValue(obj, 'key1.key11')

    // Then
    expect(result).toEqual(2)
  })

  test("returns undefined if the path value doesn't exists", () => {
    // Given
    const obj: object = {
      key1: {
        key11: 2,
      },
    }

    // When
    const result = getPathValue(obj, 'key1.key21')

    // Then
    expect(result).toBeUndefined()
  })

  test('gets a property whose name contains dots using array notation', () => {
    // Given
    const obj: object = {'key1.with.dots': 'value'}

    // When
    const result = getPathValue(obj, ['key1.with.dots'])

    // Then
    expect(result).toEqual('value')
  })
})

describe('setPathValue', () => {
  test('set the path value at the top level if it exists', () => {
    // Given
    const obj: object = {
      key1: '1',
    }

    // When
    const result = setPathValue(obj, 'key1', 2)

    // Then
    expect(getPathValue(result, 'key1')).toEqual(2)
  })

  test('set the path value inside a nested object if it exists', () => {
    // Given
    const obj: object = {
      key1: {
        key11: 2,
      },
    }

    // When
    const result = setPathValue(obj, 'key1.key11', 3)

    // Then
    expect(getPathValue(result, 'key1.key11')).toEqual(3)
  })

  test("do nothing if the path to set the value doesn't exists", () => {
    // Given
    const obj: object = {
      key1: {
        key11: 3,
      },
    }

    // When
    const result = setPathValue(obj, 'key1.key21', 4)

    // Then
    expect(result).toEqual(obj)
  })

  test('set the path value using an object', () => {
    // Given
    const obj: object = {
      key1: '1',
    }

    // When
    const result = setPathValue(obj, 'key1', {key11: 2})

    // Then
    expect(getPathValue(result, 'key1')).toEqual({key11: 2})
  })

  test('set the path value using an array path notation', () => {
    // Given
    const obj: object = {
      key1: {
        key11: 3,
      },
    }

    // When
    const result = setPathValue(obj, ['key1', 'key11'], 4)

    // Then
    expect(getPathValue(result, 'key1.key11')).toEqual(4)
  })

  test('set a property whose name contains dots using array notation', () => {
    // Given
    const obj: object = {}

    // When
    const result = setPathValue(obj, ['key1.with.dots'], 'value')

    // Then
    expect(result).toEqual({'key1.with.dots': 'value'})
    // Should NOT create a nested structure
    expect(getPathValue(result, ['key1.with.dots'])).toEqual('value')
    // Should be accessible as a top-level property
    expect((result as {[key: string]: string})['key1.with.dots']).toEqual('value')
  })

  test('set nested property under a key that contains dots', () => {
    // Given
    const obj: object = {'key1.with.dots': {}}

    // When
    const result = setPathValue(obj, ['key1.with.dots', 'nested'], 'value')

    // Then
    expect(result).toEqual({'key1.with.dots': {nested: 'value'}})
  })
})

describe('compact', () => {
  test('removes the undefined elements from the object', () => {
    // Given
    const obj: object = {
      key1: '1',
      key2: undefined,
      key3: false,
      key4: null,
      key5: 0,
    }

    // When
    const result = compact(obj)

    // Then
    expect(Object.keys(result)).toEqual(['key1', 'key3', 'key5'])
  })

  test('returns an empty object when all the values are undefined', () => {
    // Given
    const obj: object = {
      key1: undefined,
      key2: null,
    }

    // When
    const result = compact(obj)

    // Then
    expect(result).toEqual({})
  })
})

describe('unsetPathValue', () => {
  test('removes the path value at the top level if it exists', () => {
    // Given
    const obj: object = {
      key1: '1',
      key2: '2',
    }

    // When
    const result = unsetPathValue(obj, 'key1')

    // Then
    expect(result).toBeTruthy()
    expect(obj).toEqual({key2: '2'})
  })

  test('removes the path value inside a nested object if it exists', () => {
    // Given
    const obj: object = {
      key1: {
        key11: 2,
        key12: 3,
      },
    }

    // When
    const result = unsetPathValue(obj, 'key1.key11')

    // Then
    expect(result).toBeTruthy()
    expect(obj).toEqual({key1: {key12: 3}})
  })

  test('returns true and does not modify the object if the specific path does not exist', () => {
    // Given
    const obj: object = {
      key1: {
        key11: 3,
      },
    }

    // When
    const result = unsetPathValue(obj, 'key1.key21')

    // Then
    expect(result).toBeTruthy()
    expect(obj).toEqual({key1: {key11: 3}})
  })

  test('returns false when trying to remove a property from a frozen object', () => {
    // Given
    const obj: object = {
      key1: '1',
      key2: '2',
    }
    Object.freeze(obj)

    // When
    const result = unsetPathValue(obj, 'key1')

    // Then
    expect(result).toBeFalsy()
    expect(obj).toEqual({key1: '1', key2: '2'})
  })

  test('returns false when trying to remove a non-configurable property', () => {
    // Given
    const obj: object = {}
    Object.defineProperty(obj, 'key1', {
      value: '1',
      configurable: false,
      enumerable: true,
    })

    // When
    const result = unsetPathValue(obj, 'key1')

    // Then
    expect(result).toBeFalsy()
    expect(Object.prototype.hasOwnProperty.call(obj, 'key1')).toBeTruthy()
  })

  test('removes the path value using array path notation', () => {
    // Given
    const obj: object = {
      key1: {
        key11: 2,
        key12: 3,
      },
    }

    // When
    const result = unsetPathValue(obj, ['key1', 'key11'])

    // Then
    expect(result).toBeTruthy()
    expect(obj).toEqual({key1: {key12: 3}})
  })

  test('removes a property whose name contains dots using array notation', () => {
    // Given
    const obj: object = {'key1.with.dots': 'value', regular: 'value2'}

    // When
    const result = unsetPathValue(obj, ['key1.with.dots'])

    // Then
    expect(result).toBeTruthy()
    expect(obj).toEqual({regular: 'value2'})
  })
})
