import {
  compact,
  deepCompare,
  deepCopy,
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

describe('deepCopy', () => {
  test('creates a deep copy of a simple object', () => {
    // Given
    const original = {name: 'test', value: 42}

    // When
    const copy = deepCopy(original)

    // Then
    expect(copy).toEqual(original)
    expect(copy).not.toBe(original)
  })

  test('creates a deep copy of nested objects', () => {
    // Given
    const original = {
      user: {
        name: 'John',
        address: {
          city: 'Berlin',
          country: 'Germany',
        },
      },
      settings: {
        theme: 'dark',
        notifications: true,
      },
    }

    // When
    const copy = deepCopy(original)

    // Then
    expect(copy).toEqual(original)
    expect(copy.user).not.toBe(original.user)
    expect(copy.user.address).not.toBe(original.user.address)
    expect(copy.settings).not.toBe(original.settings)
  })

  test('creates a deep copy of arrays', () => {
    // Given
    const original = {
      items: [1, 2, 3],
      nested: [
        [1, 2],
        [3, 4],
      ],
      mixed: [
        {id: 1, name: 'first'},
        {id: 2, name: 'second'},
      ],
    }

    // When
    const copy = deepCopy(original)

    // Then
    expect(copy).toEqual(original)
    expect(copy.items).not.toBe(original.items)
    expect(copy.nested).not.toBe(original.nested)
    expect(copy.nested[0]).not.toBe(original.nested[0])
    expect(copy.mixed[0]).not.toBe(original.mixed[0])
  })

  test('creates a deep copy of Maps', () => {
    // Given
    const original = new Map<string, any>([
      ['key1', 'value1'],
      ['key2', {nested: 'value'}],
    ])

    // When
    const copy = deepCopy(original)

    // Then
    expect(copy).toEqual(original)
    expect(copy).not.toBe(original)
    expect(copy.get('key2')).not.toBe(original.get('key2'))
  })

  test('creates a deep copy of Sets', () => {
    // Given
    const original = new Set([1, 2, 3, {value: 'test'}])

    // When
    const copy = deepCopy(original)

    // Then
    expect(copy).toEqual(original)
    expect(copy).not.toBe(original)

    // Verify the object inside the set is also copied
    const originalObj = Array.from(original).find((item) => typeof item === 'object')
    const copyObj = Array.from(copy).find((item) => typeof item === 'object')
    expect(copyObj).toEqual(originalObj)
    expect(copyObj).not.toBe(originalObj)
  })

  test('creates a deep copy of Maps with Sets as values', () => {
    // Given
    const original = new Map<string, Set<any>>([
      ['extensions', new Set(['ext1', 'ext2'])],
      ['files', new Set([{path: '/file1'}, {path: '/file2'}])],
    ])

    // When
    const copy = deepCopy(original)

    // Then
    expect(copy).toEqual(original)
    expect(copy).not.toBe(original)
    expect(copy.get('extensions')).not.toBe(original.get('extensions'))
    expect(copy.get('files')).not.toBe(original.get('files'))
  })

  test('mutations to the copy do not affect the original', () => {
    // Given
    const original = {
      user: {name: 'John', tags: ['admin', 'user']},
      settings: new Map([['theme', 'dark']]),
      permissions: new Set(['read', 'write']),
    }

    // When
    const copy = deepCopy(original)
    copy.user.name = 'Jane'
    copy.user.tags.push('moderator')
    copy.settings.set('theme', 'light')
    copy.permissions.add('delete')

    // Then
    expect(original.user.name).toBe('John')
    expect(original.user.tags).toEqual(['admin', 'user'])
    expect(original.settings.get('theme')).toBe('dark')
    expect(original.permissions.has('delete')).toBe(false)
  })

  test('handles dates correctly', () => {
    // Given
    const original = {
      created: new Date('2024-01-01'),
      updated: new Date('2024-06-01'),
    }

    // When
    const copy = deepCopy(original)

    // Then
    expect(copy.created).toEqual(original.created)
    expect(copy.created).not.toBe(original.created)
    expect(copy.created.getTime()).toBe(original.created.getTime())
  })

  test('handles null and undefined values', () => {
    // Given
    const original = {
      nullValue: null,
      undefinedValue: undefined,
      nested: {
        nullValue: null,
        undefinedValue: undefined,
      },
    }

    // When
    const copy = deepCopy(original)

    // Then
    expect(copy).toEqual(original)
  })

  test('handles circular references', () => {
    // Given
    const original: any = {name: 'test'}
    original.self = original

    // When/Then - lodash cloneDeep handles circular references
    expect(() => deepCopy(original)).not.toThrow()
  })
})
