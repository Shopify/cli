import {encodeGid, numericIdFromEncodedGid, numericIdFromGid} from './gid.js'
import {describe, expect, test} from 'vitest'

describe('numericIdFromGid', () => {
  test('extracts the trailing numeric id from a plain gid', () => {
    expect(numericIdFromGid('gid://shopify/Product/1234')).toBe('1234')
    expect(numericIdFromGid('gid://organization/Organization/9876')).toBe('9876')
  })

  test('returns undefined when there is no trailing /<digits>', () => {
    expect(numericIdFromGid('gid://shopify/Product/ABC')).toBeUndefined()
    expect(numericIdFromGid('not-a-gid')).toBeUndefined()
    expect(numericIdFromGid('1234')).toBeUndefined()
  })
})

describe('numericIdFromEncodedGid', () => {
  test('extracts the trailing numeric id from a base64-encoded gid', () => {
    const gid = Buffer.from('gid://organization/Organization/1234').toString('base64')
    expect(numericIdFromEncodedGid(gid)).toBe('1234')
  })

  test('returns undefined when the decoded string does not end with /<digits>', () => {
    expect(numericIdFromEncodedGid(Buffer.from('not-a-gid').toString('base64'))).toBeUndefined()
    expect(numericIdFromEncodedGid('!!!')).toBeUndefined()
  })
})

describe('encodeGid', () => {
  test('base64-encodes a plain gid', () => {
    expect(encodeGid('gid://organization/Organization/1234')).toBe(
      Buffer.from('gid://organization/Organization/1234').toString('base64'),
    )
  })

  test('round-trips with numericIdFromEncodedGid', () => {
    expect(numericIdFromEncodedGid(encodeGid('gid://shopify/Product/42'))).toBe('42')
  })
})
