import {
  asHumanFriendlyArray,
  difference,
  getArrayContainsDuplicates,
  getArrayRejectingUndefined,
  takeRandomFromArray,
  uniq,
  uniqBy,
} from './array.js'
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
  test('returns a random element from the array', () => {
    // Given
    const array = [1, 2, 3, 4, 5]

    // When
    const got = takeRandomFromArray(array)

    // Then
    expect(array).toContain(got)
  })
})

describe('getArrayRejectingUndefined', () => {
  test('removes undefined elements', () => {
    // Given
    const array = [1, undefined, 2, undefined, 3]

    // When
    const got = getArrayRejectingUndefined(array)

    // Then
    expect(got).toEqual([1, 2, 3])
  })

  test('keeps other falsy values', () => {
    // Given
    const array = [0, '', null, false, undefined] as any[]

    // When
    const got = getArrayRejectingUndefined(array)

    // Then
    expect(got).toEqual([0, '', null, false])
  })
})

describe('getArrayContainsDuplicates', () => {
  test('returns true if there are duplicates', () => {
    // Given
    const array = [1, 2, 2, 3]

    // When
    const got = getArrayContainsDuplicates(array)

    // Then
    expect(got).toBe(true)
  })

  test('returns false if there are no duplicates', () => {
    // Given
    const array = [1, 2, 3]

    // When
    const got = getArrayContainsDuplicates(array)

    // Then
    expect(got).toBe(false)
  })
})

describe('asHumanFriendlyArray', () => {
  test('returns empty array if input is empty', () => {
    // Given
    const array: string[] = []

    // When
    const got = asHumanFriendlyArray(array)

    // Then
    expect(got).toEqual([])
  })

  test('returns single item array if input has one item', () => {
    // Given
    const array = ['apple']

    // When
    const got = asHumanFriendlyArray(array)

    // Then
    expect(got).toEqual(['apple'])
  })

  test('returns two items separated by and', () => {
    // Given
    const array = ['apple', 'banana']

    // When
    const got = asHumanFriendlyArray(array)

    // Then
    expect(got).toEqual(['apple', 'and', 'banana'])
  })

  test('returns multiple items separated by commas and and', () => {
    // Given
    const array = ['apple', 'banana', 'cherry']

    // When
    const got = asHumanFriendlyArray(array)

    // Then
    expect(got).toEqual(['apple', ', ', 'banana', 'and', 'cherry'])
  })

  test('handles more than three items', () => {
    // Given
    const array = ['apple', 'banana', 'cherry', 'date']

    // When
    const got = asHumanFriendlyArray(array)

    // Then
    expect(got).toEqual(['apple', ', ', 'banana', ', ', 'cherry', 'and', 'date'])
  })
})
