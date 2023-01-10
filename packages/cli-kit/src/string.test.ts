import {hashString} from './string.js'
import {describe, expect, it} from 'vitest'

describe('hashString', () => {
  it('converts a string to its consistent hash', () => {
    const hash1 = hashString('hello')
    const hash2 = hashString('hello')
    expect(hash1).toEqual(hash2)
    expect(hash1).toMatch(/[a-f0-9]{40}/)
  })
})
