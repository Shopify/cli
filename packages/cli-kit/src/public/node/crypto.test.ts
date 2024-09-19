import {fileHash, hashString, nonRandomUUID} from './crypto.js'
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
