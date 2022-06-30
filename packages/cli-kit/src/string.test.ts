import {normalizeStoreName} from './string.js'
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

  it('parses store name without domain', () => {
    // When
    const got = normalizeStoreName('example')

    // Then
    expect(got).toEqual('example.myshopify.com')
  })
})
