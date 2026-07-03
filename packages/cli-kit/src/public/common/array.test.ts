import {difference, takeRandomFromArray, uniq, uniqBy} from './array.js'
import {describe, test, expect} from 'vitest'

describe('uniqBy', () => {
  test('removes duplicates', () => {
    // When
    const got = uniqBy(
      [
        {
          city: 'Berlin',
          name: 'user1',
        },
        {
          city: 'Berlin',
          name: 'user2',
        },
        {
          city: 'London',
          name: 'user3',
        },
      ],
      'city',
    )

    // Then
    expect(got).toEqual([
      {
        city: 'Berlin',
        name: 'user1',
      },
      {
        city: 'London',
        name: 'user3',
      },
    ])
  })
})

describe('uniq', () => {
  test('removes duplicates', () => {
    // Given
    const array = [1, 2, 2, 3]

    // When
    const got = uniq(array)

    // Then
    expect(got).toEqual([1, 2, 3])
  })
})

describe('difference', () => {
  test('returns the different elements', () => {
    // Given
    const first = [2, 1]
    const second = [2, 3]

    // When
    const got = difference(first, second)

    // Then
    expect(got).toEqual([1])
  })
})

describe('takeRandomFromArray', () => {
  test('returns an element from the array', () => {
    // Given
    const array = ['apple', 'banana', 'cherry']

    // When
    const got = takeRandomFromArray(array)

    // Then
    expect(array).toContain(got)
  })

  test('returns the only element from a single-element array', () => {
    // Given
    const array = ['apple']

    // When
    const got = takeRandomFromArray(array)

    // Then
    expect(got).toBe('apple')
  })

  test('returns undefined for an empty array', () => {
    // Given
    const array: string[] = []

    // When
    const got = takeRandomFromArray(array)

    // Then
    expect(got).toBeUndefined()
  })
})
