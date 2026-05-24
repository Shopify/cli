import {difference, takeRandomFromArray, uniq, uniqBy} from './array.js'
import {describe, test, expect} from 'vitest'

describe('takeRandomFromArray', () => {
  test('returns an element from the array', () => {
    const array = [1, 2, 3]
    const got = takeRandomFromArray(array)
    expect(array).toContain(got)
  })

  test('returns undefined for an empty array', () => {
    const array: number[] = []
    const got = takeRandomFromArray(array)
    expect(got).toBeUndefined()
  })
})

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
