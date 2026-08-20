import {unionArrayStrategy} from './array.js'
import {describe, test, expect} from 'vitest'

describe('unionArrayStrategy', () => {
  test('combines two arrays and removes duplicates', () => {
    // Given
    const destination = ['a', 'b']
    const source = ['b', 'c']

    // When
    const result = unionArrayStrategy(destination, source)

    // Then
    expect(result).toEqual(['a', 'b', 'c'])
  })

  test('handles empty arrays', () => {
    // Given
    const destination: unknown[] = []
    const source = [1, 2]

    // When
    const result = unionArrayStrategy(destination, source)

    // Then
    expect(result).toEqual([1, 2])
  })

  test('handles non-overlapping arrays', () => {
    // Given
    const destination = [1, 2]
    const source = [3, 4]

    // When
    const result = unionArrayStrategy(destination, source)

    // Then
    expect(result).toEqual([1, 2, 3, 4])
  })
})
