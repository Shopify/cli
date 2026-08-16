import {
  fileHash,
  hashString,
  nonRandomUUID,
  randomHex,
  base64URLEncode,
  sha256,
  randomBytes,
  randomUUID,
} from './crypto.js'
import {describe, expect, test} from 'vitest'

describe('hashString', () => {
  test('converts a string to its consistent hash', () => {
    const hash1 = hashString('hello')
    const hash2 = hashString('hello')
    expect(hash1).toEqual(hash2)
    expect(hash1).toMatch(/[a-f0-9]{40}/)
  })
})

describe('fileHash', () => {
  test('converts a buffer to its consistent hash', () => {
    const hash1 = fileHash(Buffer.from('hello'))
    const hash2 = fileHash(Buffer.from('hello'))
    expect(hash1).toEqual(hash2)
    expect(hash1).toMatch(/[a-f0-9]{32}/)
  })
})

describe('nonRandomUUID', () => {
  test('generates a non-random UUID', () => {
    const uuid1 = nonRandomUUID('hello')
    const uuid2 = nonRandomUUID('hello')
    expect(uuid1).toEqual(uuid2)
    expect(uuid1).toMatch(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/)
  })

  test('generates a non-random UUID', () => {
    const uuid1 = nonRandomUUID('hello')
    const uuid2 = nonRandomUUID('hello2')
    expect(uuid1).not.toEqual(uuid2)
  })
})

describe('randomHex', () => {
  test('generates a random hexadecimal string of the specified size in bytes', () => {
    const hex1 = randomHex(16)
    const hex2 = randomHex(16)
    expect(hex1).not.toEqual(hex2)
    expect(hex1).toMatch(/^[a-f0-9]{32}$/)
    expect(hex2).toMatch(/^[a-f0-9]{32}$/)
  })
})

describe('base64URLEncode', () => {
  test('encodes a buffer to base64url format', () => {
    const buffer = Buffer.from('hello+world/foo=bar')
    const encoded = base64URLEncode(buffer)
    expect(encoded).not.toContain('+')
    expect(encoded).not.toContain('/')
    expect(encoded).not.toContain('=')
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})

describe('sha256', () => {
  test('generates SHA256 hash buffer of a string', () => {
    const hash = sha256('hello')
    expect(hash).toBeInstanceOf(Buffer)
    expect(hash.length).toBe(32)
    expect(hash.toString('hex')).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824')
  })
})

describe('randomBytes', () => {
  test('generates a buffer of random bytes of the specified size', () => {
    const bytes1 = randomBytes(16)
    const bytes2 = randomBytes(16)
    expect(bytes1).toBeInstanceOf(Buffer)
    expect(bytes1.length).toBe(16)
    expect(bytes1).not.toEqual(bytes2)
  })
})

describe('randomUUID', () => {
  test('generates a random UUID string', () => {
    const uuid1 = randomUUID()
    const uuid2 = randomUUID()
    expect(uuid1).not.toEqual(uuid2)
    expect(uuid1).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/)
  })
})
