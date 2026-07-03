import {asHumanFriendlyArray, difference, uniq, uniqBy} from './array.js'
import {describe, test, expect} from 'vitest'

describe('asHumanFriendlyArray', () => {
  test('returns an empty array when given an empty array', () => {
    // Given
    const items: string[] = []

    // When
    const got = asHumanFriendlyArray(items)

    // Then
    expect(got).toEqual([])
  })

  test('returns the same array when it has one item', () => {
    // Given
    const items = ['apple']

    // When
    const got = asHumanFriendlyArray(items)

    // Then
    expect(got).toEqual(['apple'])
  })

  test('returns the items separated by and when it has two items', () => {
    // Given
    const items = ['apple', 'banana']

    // When
    const got = asHumanFriendlyArray(items)

    // Then
    expect(got).toEqual(['apple', 'and', 'banana'])
  })

  test('returns the items separated by commas and and when it has more than two items', () => {
    // Given
    const items = ['apple', 'banana', 'orange']

    // When
    const got = asHumanFriendlyArray(items)

    // Then
    expect(got).toEqual(['apple', ', ', 'banana', 'and', 'orange'])
  })

  test('works with objects', () => {
    // Given
    const items = ['apple', 'banana', {command: '--flag'}]

    // When
    const got = asHumanFriendlyArray(items)

    // Then
    expect(got).toEqual(['apple', ', ', 'banana', 'and', {command: '--flag'}])
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
