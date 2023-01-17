import {getRandomName, linesToColumns, pluralize, tryParseInt} from './string.js'
import {describe, expect, test} from 'vitest'

describe('getRandomName', () => {
  test('generates a non-empty string', () => {
    // Given/When
    const got = getRandomName()

    // Then
    expect(got.length).not.toBe(0)
  })
})

describe('tryParseInt', () => {
  test('converts a string to an int', () => {
    expect(tryParseInt('  999 ')).toEqual(999)
  })
  test('ignores unspecified strings', () => {
    expect(tryParseInt(undefined)).toEqual(undefined)
  })
  test('ignores bad strings', () => {
    expect(tryParseInt('not this')).toEqual(undefined)
  })
})

describe('linesToColumns', () => {
  test('converts a set of lines to columns', () => {
    // Given
    const lines = [
      ['one', 'two', 'three'],
      ['four', 'five', 'six'],
    ]

    // When
    const got = linesToColumns(lines)

    // Then
    expect(got).toEqual(
      `
one    two    three
four   five   six
`.trim(),
    )
  })
})

describe('pluralize', () => {
  const pluralized = (items: string[]) => {
    return pluralize(
      items,
      (items) => `This list has many items: ${items.join(', ')}`,
      (item) => `This list has a single item (${item})`,
      () => 'This list has no items',
    )
  }

  test('formats the list when it has many items', () => {
    // Given
    const lines = ['one', 'two', 'three']

    // When
    const str = pluralized(lines)

    // Then
    expect(str).toBe('This list has many items: one, two, three')
  })

  test('formats the list when it has only one item', () => {
    // Given
    const lines = ['one']

    // When
    const str = pluralized(lines)

    // Then
    expect(str).toBe('This list has a single item (one)')
  })

  test('formats the list when it has no items', () => {
    // Given/When
    const str = pluralized([])

    // Then
    expect(str).toBe('This list has no items')
  })
})
