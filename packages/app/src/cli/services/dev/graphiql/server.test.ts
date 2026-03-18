import {deriveGraphiQLKey, resolveGraphiQLKey} from './server.js'
import {describe, expect, test} from 'vitest'

describe('deriveGraphiQLKey', () => {
  test('returns a 64-character hex string', () => {
    const key = deriveGraphiQLKey('secret', 'store.myshopify.com')
    expect(key).toMatch(/^[0-9a-f]{64}$/)
  })

  test('is deterministic — same inputs produce the same key', () => {
    const key1 = deriveGraphiQLKey('secret', 'store.myshopify.com')
    const key2 = deriveGraphiQLKey('secret', 'store.myshopify.com')
    expect(key1).toBe(key2)
  })

  test('different secrets produce different keys', () => {
    const key1 = deriveGraphiQLKey('secret-1', 'store.myshopify.com')
    const key2 = deriveGraphiQLKey('secret-2', 'store.myshopify.com')
    expect(key1).not.toBe(key2)
  })

  test('different stores produce different keys', () => {
    const key1 = deriveGraphiQLKey('secret', 'store-a.myshopify.com')
    const key2 = deriveGraphiQLKey('secret', 'store-b.myshopify.com')
    expect(key1).not.toBe(key2)
  })
})

describe('resolveGraphiQLKey', () => {
  test('uses provided key when non-empty', () => {
    const key = resolveGraphiQLKey('my-custom-key', 'secret', 'store.myshopify.com')
    expect(key).toBe('my-custom-key')
  })

  test('derives key when provided key is undefined', () => {
    const key = resolveGraphiQLKey(undefined, 'secret', 'store.myshopify.com')
    expect(key).toBe(deriveGraphiQLKey('secret', 'store.myshopify.com'))
  })

  test('derives key when provided key is empty string', () => {
    const key = resolveGraphiQLKey('', 'secret', 'store.myshopify.com')
    expect(key).toBe(deriveGraphiQLKey('secret', 'store.myshopify.com'))
  })

  test('derives key when provided key is whitespace-only', () => {
    const key = resolveGraphiQLKey('   ', 'secret', 'store.myshopify.com')
    expect(key).toBe(deriveGraphiQLKey('secret', 'store.myshopify.com'))
  })
})
