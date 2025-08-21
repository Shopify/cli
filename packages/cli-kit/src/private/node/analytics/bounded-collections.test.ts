import {BArray, BMap} from './bounded-collections.js'
import {describe, test, expect} from 'vitest'

describe('BArray', () => {
  test('push adds items and enforces size limit', () => {
    // Given
    const array = new BArray<number>()

    // When
    for (let i = 0; i < 1500; i++) {
      array.push(i)
    }

    // Then
    expect(array.length).toBe(1000)
    expect(array[0]).toBe(500)
    expect(array[999]).toBe(1499)
  })

  test('clear removes all items', () => {
    // Given
    const array = new BArray<string>()
    array.push('a', 'b', 'c', 'd', 'e')

    // When
    array.clear()

    // Then
    expect(array.length).toBe(0)
    expect(array.toArray()).toEqual([])
  })

  test('toArray returns a copy of the array', () => {
    // Given
    const array = new BArray<string>()
    array.push('a', 'b', 'c')

    // When
    const copy = array.toArray()

    // Then
    expect(copy).toEqual(['a', 'b', 'c'])
    expect(copy).not.toBe(array)
    copy.push('d')
    expect(array.length).toBe(3)
  })

  test('works with complex objects', () => {
    // Given
    const array = new BArray<{id: number; name: string}>()
    const objects = [
      {id: 1, name: 'first'},
      {id: 2, name: 'second'},
      {id: 3, name: 'third'},
    ]

    // When
    array.push(...objects)

    // Then
    expect(array.length).toBe(3)
    expect(array[0]).toEqual({id: 1, name: 'first'})
    expect(array[2]).toEqual({id: 3, name: 'third'})
  })

  test('standard array methods work as expected', () => {
    // Given
    const array = new BArray<number>()
    array.push(1, 2, 3, 4, 5)

    // When
    // Then
    expect(array.map((x) => x * 2)).toEqual([2, 4, 6, 8, 10])
    expect(array.filter((x) => x % 2 === 0)).toEqual([2, 4])
    expect(array.find((x) => x > 3)).toBe(4)
    expect(array.includes(3)).toBe(true)
    expect(array.indexOf(4)).toBe(3)
  })
})

describe('BMap', () => {
  test('set adds entries and enforces size limit', () => {
    // Given
    const map = new BMap<number, string>()

    // When
    for (let i = 0; i < 1500; i++) {
      map.set(i, `value-${i}`)
    }

    // Then
    expect(map.size).toBe(1000)
    expect(map.has(0)).toBe(false)
    expect(map.has(499)).toBe(false)
    expect(map.has(500)).toBe(true)
    expect(map.get(1499)).toBe('value-1499')
  })

  test('maintains insertion order when enforcing limit', () => {
    // Given
    const map = new BMap<string, number>()

    // When
    for (let i = 0; i < 1100; i++) {
      map.set(`key-${i}`, i)
    }

    // Then
    expect(map.size).toBe(1000)
    expect(map.has('key-0')).toBe(false)
    expect(map.has('key-99')).toBe(false)
    expect(map.has('key-100')).toBe(true)
    expect(map.has('key-1099')).toBe(true)
  })

  test('updating existing key does not change insertion order', () => {
    // Given
    const map = new BMap<string, number>()
    map.set('a', 1)
    map.set('b', 2)
    map.set('c', 3)

    // When
    map.set('a', 10)

    // Then
    expect(map.get('a')).toBe(10)
    expect(map.size).toBe(3)
    const entries = Array.from(map.entries())
    expect(entries).toEqual([
      ['a', 10],
      ['b', 2],
      ['c', 3],
    ])
  })

  test('delete removes entry and updates insertion order', () => {
    // Given
    const map = new BMap<string, number>()
    map.set('a', 1)
    map.set('b', 2)
    map.set('c', 3)

    // When
    const deleted = map.delete('b')

    // Then
    expect(deleted).toBe(true)
    expect(map.size).toBe(2)
    expect(map.has('b')).toBe(false)

    // When
    const deletedAgain = map.delete('b')
    expect(deletedAgain).toBe(false)
  })

  test('clear removes all entries', () => {
    // Given
    const map = new BMap<string, number>()
    map.set('a', 1)
    map.set('b', 2)
    map.set('c', 3)

    // When
    map.clear()

    // Then
    expect(map.size).toBe(0)
    expect(map.has('a')).toBe(false)
    expect(map.toObject()).toEqual({})
  })

  test('toObject converts map to plain object', () => {
    // Given
    const map = new BMap<string, number>()
    map.set('foo', 1)
    map.set('bar', 2)
    map.set('baz', 3)

    // When
    const obj = map.toObject()

    // Then
    expect(obj).toEqual({
      foo: 1,
      bar: 2,
      baz: 3,
    })
  })

  test('works with complex key types', () => {
    // Given
    const map = new BMap<{id: number}, string>()
    const key1 = {id: 1}
    const key2 = {id: 2}

    // When
    map.set(key1, 'value1')
    map.set(key2, 'value2')

    // Then
    expect(map.get(key1)).toBe('value1')
    expect(map.get(key2)).toBe('value2')
    expect(map.size).toBe(2)
  })

  test('standard map methods work as expected', () => {
    // Given
    const map = new BMap<string, number>()
    map.set('a', 1)
    map.set('b', 2)
    map.set('c', 3)

    // When
    const keys = Array.from(map.keys())
    const values = Array.from(map.values())
    const entries = Array.from(map.entries())

    // Then
    expect(keys).toEqual(['a', 'b', 'c'])
    expect(values).toEqual([1, 2, 3])
    expect(entries).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ])

    const collected: string[] = []
    map.forEach((value, key) => {
      collected.push(`${key}:${value}`)
    })
    expect(collected).toEqual(['a:1', 'b:2', 'c:3'])
  })
})
