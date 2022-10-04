import {hashString, linesToColumns, normalizeStoreName, tryParseInt, underscoreKeys} from './string.js'
import {describe, expect, it} from 'vitest'

describe('normalizeStore', () => {
  it('parses store name with http', () => {
    // When
    const got = normalizeStoreName('http://example.myshopify.com')

    // Then
    expect(got).toEqual('example.myshopify.com')
  })

  it('parses store name with https', () => {
    // When
    const got = normalizeStoreName('https://example.myshopify.com')

    // Then
    expect(got).toEqual('example.myshopify.com')
  })

  it('parses store name with https when spin URL', () => {
    // When
    const got = normalizeStoreName('https://devstore001.shopify.partners-6xat.test.us.spin.dev')

    // Then
    expect(got).toEqual('devstore001.shopify.partners-6xat.test.us.spin.dev')
  })

  it('parses store name without domain', () => {
    // When
    const got = normalizeStoreName('example')

    // Then
    expect(got).toEqual('example.myshopify.com')
  })
})

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

describe('underscoreKeys', () => {
  it('converts the string keys of an object to underscore', () => {
    const obj = {networkAccess: true, already_underscore: true}
    const got = underscoreKeys(obj)
    expect(got).toEqual({network_access: true, already_underscore: true})
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
