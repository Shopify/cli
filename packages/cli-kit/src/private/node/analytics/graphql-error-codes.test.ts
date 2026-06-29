import {graphQLErrorCodes, hasRateLimitCode, isPermissionCode, isRateLimitCode} from './graphql-error-codes.js'
import {describe, expect, test} from 'vitest'

describe('graphQLErrorCodes', () => {
  test('reads top-level extensions.code from every error, in order', () => {
    const errors = [{extensions: {code: 'FIRST'}}, {message: 'no code'}, {extensions: {code: 'THROTTLED'}}]

    expect(graphQLErrorCodes(errors)).toEqual(['FIRST', 'THROTTLED'])
  })

  test('reads nested App Management app_errors categories', () => {
    const errors = [{extensions: {app_errors: {errors: [{category: 'access_denied'}, {category: 'other'}]}}}]

    expect(graphQLErrorCodes(errors)).toEqual(['access_denied', 'other'])
  })

  test('returns an empty array for a string errors value (some 401 responses)', () => {
    expect(graphQLErrorCodes('unauthenticated')).toEqual([])
    expect(graphQLErrorCodes(undefined)).toEqual([])
  })
})

describe('code predicates', () => {
  test('isRateLimitCode recognizes THROTTLED and the string 429', () => {
    expect(isRateLimitCode('THROTTLED')).toBe(true)
    expect(isRateLimitCode('429')).toBe(true)
    expect(isRateLimitCode('ACCESS_DENIED')).toBe(false)
    expect(isRateLimitCode(undefined)).toBe(false)
  })

  test('isPermissionCode recognizes ACCESS_DENIED and nested access_denied', () => {
    expect(isPermissionCode('ACCESS_DENIED')).toBe(true)
    expect(isPermissionCode('access_denied')).toBe(true)
    expect(isPermissionCode('THROTTLED')).toBe(false)
  })

  test('hasRateLimitCode scans all errors, not just the first', () => {
    expect(hasRateLimitCode([{message: 'a'}, {extensions: {code: '429'}}])).toBe(true)
    expect(hasRateLimitCode([{extensions: {code: 'OTHER'}}])).toBe(false)
  })
})
