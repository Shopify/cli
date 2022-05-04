import {generateRandomUUID} from './id'
import {describe, expect, test} from 'vitest'

describe('generateRandomUUID', () => {
  test('returns a random UUID', () => {
    // Given
    const got = generateRandomUUID()

    // Then
    expect(got).not.toEqual('')
  })
})
