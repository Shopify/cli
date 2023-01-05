import {hashString, linesToColumns, tryParseInt} from './string.js'
import {describe, expect, it} from 'vitest'

describe('tryParseInt', () => {
  it('converts a string to an int', () => {
    expect(tryParseInt('  999 ')).toEqual(999)
  })
  it('ignores unspecified strings', () => {
    expect(tryParseInt(undefined)).toEqual(undefined)
  })
  it('ignores bad strings', () => {
    expect(tryParseInt('not this')).toEqual(undefined)
  })
})

describe('hashString', () => {
  it('converts a string to its consistent hash', () => {
    const hash1 = hashString('hello')
    const hash2 = hashString('hello')
    expect(hash1).toEqual(hash2)
    expect(hash1).toMatch(/[a-f0-9]{40}/)
  })
})

describe('linesToColumns', () => {
  it('converts a set of lines to columns', () => {
    const lines = [
      ['one', 'two', 'three'],
      ['four', 'five', 'six'],
    ]
    const got = linesToColumns(lines)
    expect(got).toEqual(
      `
one    two    three
four   five   six
`.trim(),
    )
  })
})
