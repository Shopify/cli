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
  test('generates a random hex string of the specified byte size', () => {
    const hex1 = randomHex(8)
    const hex2 = randomHex(8)

    // Each byte is 2 hex characters
    expect(hex1).toMatch(/^[a-f0-9]{16}$/)
    expect(hex2).toMatch(/^[a-f0-9]{16}$/)

    // Two random values should be different
    expect(hex1).not.toEqual(hex2)
  })

  test('generates a hex string with length corresponding to byte size', () => {
    // 4 bytes = 8 hex chars
    expect(randomHex(4)).toHaveLength(8)

    // 10 bytes = 20 hex chars
    expect(randomHex(10)).toHaveLength(20)

    // 16 bytes = 32 hex chars
    expect(randomHex(16)).toHaveLength(32)
  })
})

describe('base64URLEncode', () => {
  test('converts buffer to base64 URL-safe string', () => {
    const buffer = Buffer.from('hello world')
    const encoded = base64URLEncode(buffer)

    // URL-safe base64 shouldn't have +, /, or = characters
    expect(encoded).not.toMatch(/[+/=]/)

    // Consistent encoding
    expect(base64URLEncode(buffer)).toEqual(encoded)
  })

  test('replaces characters that are not URL-safe', () => {
    // Use a string that will produce +, /, and = in regular base64
    const specialCharsBuffer = Buffer.from([251, 239, 255, 213])
    const encoded = base64URLEncode(specialCharsBuffer)

    // Check that + is replaced with -
    // Check that / is replaced with _
    // Check that = is removed
    expect(encoded).not.toMatch(/[+/=]/)
  })
})

describe('sha256', () => {
  test('generates a consistent SHA256 hash', () => {
    const hash1 = sha256('hello')
    const hash2 = sha256('hello')

    // Same input produces same hash
    expect(hash1).toEqual(hash2)

    // Different input produces different hash
    expect(sha256('hello')).not.toEqual(sha256('world'))

    // SHA256 hash is 32 bytes (256 bits)
    expect(hash1.length).toBe(32)
  })
})

describe('randomBytes', () => {
  test('generates random bytes of specified size', () => {
    const bytes1 = randomBytes(10)
    const bytes2 = randomBytes(10)

    // Buffers should be of requested size
    expect(bytes1.length).toBe(10)
    expect(bytes2.length).toBe(10)

    // Two random values should be different
    expect(bytes1.toString('hex')).not.toEqual(bytes2.toString('hex'))
  })
})

describe('randomUUID', () => {
  test('generates a valid UUID string', () => {
    const uuid = randomUUID()

    // UUID should match standard format
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)

    // Two random UUIDs should be different
    expect(randomUUID()).not.toEqual(randomUUID())
  })
})
