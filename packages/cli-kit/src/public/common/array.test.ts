import {asHumanFriendlyArray, difference, uniq, uniqBy} from './array.js'
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

describe('asHumanFriendlyArray', () => {
  test('returns the same array if it has less than 2 elements', () => {
    // Given
    const array = ['apple']

    // When
    const got = asHumanFriendlyArray(array)

    // Then
    expect(got).toEqual(['apple'])
  })

  test('returns a human friendly array if it has 2 elements', () => {
    // Given
    const array = ['apple', 'banana']

    // When
    const got = asHumanFriendlyArray(array)

    // Then
    expect(got).toEqual(['apple', 'and', 'banana'])
  })

  test('returns a human friendly array if it has more than 2 elements', () => {
    // Given
    const array = ['apple', 'banana', 'orange']

    // When
    const got = asHumanFriendlyArray(array)

    // Then
    expect(got).toEqual(['apple', ', ', 'banana', 'and', 'orange'])
  })
})
