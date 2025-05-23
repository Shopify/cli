import {
  difference,
  uniq,
  uniqBy,
  takeRandomFromArray,
  getArrayRejectingUndefined,
  getArrayContainsDuplicates,
  asHumanFriendlyArray,
} from './array.js'
import {describe, test, expect} from 'vitest'

describe('takeRandomFromArray', () => {
  test('returns an element from the array', () => {
    // Given
    const array = ['a', 'b', 'c', 'd']

    // When
    const result = takeRandomFromArray(array)

    // Then
    expect(array).toContain(result)
  })

  test('returns different elements on multiple calls (statistically)', () => {
    // Given
    const array = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    const results = new Set()

    // When - call multiple times to get different random values
    for (let i = 0; i < 20; i++) {
      results.add(takeRandomFromArray(array))
    }

    // Then - should have gotten more than one unique value
    expect(results.size).toBeGreaterThan(1)
  })

  test('returns the only element when array has one item', () => {
    // Given
    const array = ['single']

    // When
    const result = takeRandomFromArray(array)

    // Then
    expect(result).toBe('single')
  })
})

describe('getArrayRejectingUndefined', () => {
  test('removes undefined elements from array', () => {
    // Given
    const array = ['a', undefined, 'b', undefined, 'c']

    // When
    const result = getArrayRejectingUndefined(array)

    // Then
    expect(result).toEqual(['a', 'b', 'c'])
  })

  test('returns empty array when all elements are undefined', () => {
    // Given
    const array = [undefined, undefined, undefined]

    // When
    const result = getArrayRejectingUndefined(array)

    // Then
    expect(result).toEqual([])
  })

  test('returns same array when no undefined elements', () => {
    // Given
    const array = ['a', 'b', 'c']

    // When
    const result = getArrayRejectingUndefined(array)

    // Then
    expect(result).toEqual(['a', 'b', 'c'])
  })

  test('handles empty array', () => {
    // Given
    const array: (string | undefined)[] = []

    // When
    const result = getArrayRejectingUndefined(array)

    // Then
    expect(result).toEqual([])
  })

  test('handles mixed types', () => {
    // Given
    const array = [1, undefined, 'string', undefined, true, null]

    // When
    const result = getArrayRejectingUndefined(array)

    // Then
    expect(result).toEqual([1, 'string', true, null])
  })
})

describe('getArrayContainsDuplicates', () => {
  test('returns true when array contains duplicates', () => {
    // Given
    const array = ['a', 'b', 'a', 'c']

    // When
    const result = getArrayContainsDuplicates(array)

    // Then
    expect(result).toBe(true)
  })

  test('returns false when array has no duplicates', () => {
    // Given
    const array = ['a', 'b', 'c', 'd']

    // When
    const result = getArrayContainsDuplicates(array)

    // Then
    expect(result).toBe(false)
  })

  test('returns false for empty array', () => {
    // Given
    const array: string[] = []

    // When
    const result = getArrayContainsDuplicates(array)

    // Then
    expect(result).toBe(false)
  })

  test('returns false for single element array', () => {
    // Given
    const array = ['a']

    // When
    const result = getArrayContainsDuplicates(array)

    // Then
    expect(result).toBe(false)
  })

  test('handles number duplicates', () => {
    // Given
    const array = [1, 2, 3, 2]

    // When
    const result = getArrayContainsDuplicates(array)

    // Then
    expect(result).toBe(true)
  })
})

describe('asHumanFriendlyArray', () => {
  test('handles empty array', () => {
    // Given
    const array: string[] = []

    // When
    const result = asHumanFriendlyArray(array)

    // Then
    expect(result).toEqual([])
  })

  test('handles single item array', () => {
    // Given
    const array = ['apple']

    // When
    const result = asHumanFriendlyArray(array)

    // Then
    expect(result).toEqual(['apple'])
  })

  test('handles two item array', () => {
    // Given
    const array = ['apple', 'banana']

    // When
    const result = asHumanFriendlyArray(array)

    // Then
    expect(result).toEqual(['apple', 'and', 'banana'])
  })

  test('handles three item array', () => {
    // Given
    const array = ['apple', 'banana', 'cherry']

    // When
    const result = asHumanFriendlyArray(array)

    // Then
    expect(result).toEqual(['apple', ', ', 'banana', 'and', 'cherry'])
  })

  test('handles multiple items array', () => {
    // Given
    const array = ['apple', 'banana', 'cherry', 'date']

    // When
    const result = asHumanFriendlyArray(array)

    // Then
    expect(result).toEqual(['apple', ', ', 'banana', ', ', 'cherry', 'and', 'date'])
  })

  test('handles mixed types', () => {
    // Given
    const array = ['apple', {command: '--flag'}, 'banana']

    // When
    const result = asHumanFriendlyArray(array)

    // Then
    expect(result).toEqual(['apple', ', ', {command: '--flag'}, 'and', 'banana'])
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

  test('handles null input', () => {
    // When
    const got = uniqBy(null, 'key')

    // Then
    expect(got).toEqual([])
  })

  test('handles undefined input', () => {
    // When
    const got = uniqBy(undefined, 'key')

    // Then
    expect(got).toEqual([])
  })

  test('works with function iteratee', () => {
    // Given
    const array = [
      {name: 'Alice', age: 25},
      {name: 'Bob', age: 25},
      {name: 'Charlie', age: 30},
    ]

    // When
    const got = uniqBy(array, (item) => item.age)

    // Then
    expect(got).toEqual([
      {name: 'Alice', age: 25},
      {name: 'Charlie', age: 30},
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

  test('handles empty array', () => {
    // Given
    const array: number[] = []

    // When
    const got = uniq(array)

    // Then
    expect(got).toEqual([])
  })

  test('handles array with no duplicates', () => {
    // Given
    const array = [1, 2, 3, 4]

    // When
    const got = uniq(array)

    // Then
    expect(got).toEqual([1, 2, 3, 4])
  })

  test('handles string array', () => {
    // Given
    const array = ['a', 'b', 'a', 'c', 'b']

    // When
    const got = uniq(array)

    // Then
    expect(got).toEqual(['a', 'b', 'c'])
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

  test('handles empty arrays', () => {
    // Given
    const first: number[] = []
    const second = [2, 3]

    // When
    const got = difference(first, second)

    // Then
    expect(got).toEqual([])
  })

  test('handles null input', () => {
    // Given
    const second = [2, 3]

    // When
    const got = difference(null, second)

    // Then
    expect(got).toEqual([])
  })

  test('handles multiple exclusion arrays', () => {
    // Given
    const first = [1, 2, 3, 4, 5]
    const second = [2, 3]
    const third = [4]

    // When
    const got = difference(first, second, third)

    // Then
    expect(got).toEqual([1, 5])
  })

  test('handles string arrays', () => {
    // Given
    const first = ['a', 'b', 'c']
    const second = ['b', 'd']

    // When
    const got = difference(first, second)

    // Then
    expect(got).toEqual(['a', 'c'])
  })
})
