import {difference, getArrayContainsDuplicates, uniq, uniqBy} from './array.js'
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

describe('getArrayContainsDuplicates', () => {
  test('returns true if the array contains duplicates', () => {
    // Given
    const array = [1, 2, 2, 3]

    // When
    const got = getArrayContainsDuplicates(array)

    // Then
    expect(got).toBe(true)
  })

  test('returns false if the array does not contain duplicates', () => {
    // Given
    const array = [1, 2, 3]

    // When
    const got = getArrayContainsDuplicates(array)

    // Then
    expect(got).toBe(false)
  })

  test('returns false for an empty array', () => {
    // Given
    const array: number[] = []

    // When
    const got = getArrayContainsDuplicates(array)

    // Then
    expect(got).toBe(false)
  })
})
