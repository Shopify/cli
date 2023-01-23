import {hashString, base64URLEncode} from './crypto.js'
import {describe, expect, it} from 'vitest'

describe('hashString', () => {
  it('converts a string to its consistent hash', () => {
    const hash1 = hashString('hello')
    const hash2 = hashString('hello')
    expect(hash1).toEqual(hash2)
    expect(hash1).toMatch(/[a-f0-9]{40}/)
  })
})

describe('base64URLEncode', () => {
  it('encodes a string to its base64 url encoded representation', () => {
    const encoded = base64URLEncode(Buffer.from('hello+/='))
    expect(encoded).toEqual("aGVsbG8rLz0")
  })
})
