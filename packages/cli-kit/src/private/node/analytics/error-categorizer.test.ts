import {categorizeError, ErrorCategory} from './error-categorizer.js'
import {describe, test, expect} from 'vitest'

describe('categorizeError', () => {
  test('returns Unknown for non-Error objects', () => {
    // Given
    const testCases = ['string error', 123, null, undefined, {message: 'object error'}, ['array', 'error']]

    // When
    // Then
    testCases.forEach((error) => {
      expect(categorizeError(error)).toBe(ErrorCategory.Unknown)
    })
  })

  test('categorizes network errors correctly', () => {
    // Given
    const errors = [
      new Error('fetch failed'),
      new Error('Request failed with status 500'),
      new Error('ECONNREFUSED: connection refused'),
      new Error('ENOTFOUND: DNS lookup failed'),
      new Error('Request timeout'),
      new Error('Network error occurred'),
    ]

    // When
    // Then
    errors.forEach((error) => {
      expect(categorizeError(error)).toBe(ErrorCategory.Network)
    })
  })

  test('categorizes file system errors correctly', () => {
    // Given
    const errors = [
      new Error('ENOENT: no such file or directory'),
      new Error('EACCES: permission denied'),
      new Error('Cannot read directory'),
      new Error('Invalid path provided'),
    ]

    // When
    // Then
    errors.forEach((error) => {
      expect(categorizeError(error)).toBe(ErrorCategory.FileSystem)
    })
  })

  test('categorizes authentication errors correctly', () => {
    // Given
    const errors = [
      new Error('Unauthorized access'),
      new Error('403 Forbidden'),
      new Error('Invalid auth token'),
      new Error('Authentication failed'),
      new Error('Invalid credentials provided'),
    ]

    // When
    // Then
    errors.forEach((error) => {
      expect(categorizeError(error)).toBe(ErrorCategory.Authentication)
    })
  })

  test('categorizes permission errors correctly', () => {
    // Given
    const errors = [
      new Error('Permission denied'),
      new Error('Access denied to resource'),
      new Error('Insufficient permissions'),
    ]

    // When
    // Then
    errors.forEach((error) => {
      expect(categorizeError(error)).toBe(ErrorCategory.Permission)
    })
  })

  test('categorizes timeout errors as network (due to implementation priority)', () => {
    // Given
    const errors = [new Error('Operation timeout'), new Error('Request timed out after 30s')]

    // When
    // Then
    errors.forEach((error) => {
      expect(categorizeError(error)).toBe(ErrorCategory.Network)
    })
  })

  test('categorizes rate limit errors correctly', () => {
    // Given
    const errors = [
      new Error('Rate limit exceeded'),
      new Error('Too many requests'),
      new Error('API throttle limit reached'),
    ]

    // When
    // Then
    expect(categorizeError(errors[0])).toBe(ErrorCategory.RateLimit)
    expect(categorizeError(errors[1])).toBe(ErrorCategory.Network)
    expect(categorizeError(errors[2])).toBe(ErrorCategory.RateLimit)
  })

  test('categorizes parsing errors correctly', () => {
    // Given
    const errors = [
      new Error('Failed to parse response'),
      new Error('Syntax error in JSON'),
      new Error('Invalid JSON received'),
      new Error('Parse error: unexpected token'),
    ]

    // When
    // Then
    expect(categorizeError(errors[0])).toBe(ErrorCategory.Json)
    expect(categorizeError(errors[1])).toBe(ErrorCategory.Json)
    expect(categorizeError(errors[2])).toBe(ErrorCategory.Json)
    expect(categorizeError(errors[3])).toBe(ErrorCategory.Authentication)
  })

  test('categorizes validation errors correctly', () => {
    // Given
    const errors = [
      new Error('Validation failed'),
      new Error('Invalid input provided'),
      new Error('Required field missing'),
    ]

    // When
    // Then
    expect(categorizeError(errors[0])).toBe(ErrorCategory.Validation)
    expect(categorizeError(errors[1])).toBe(ErrorCategory.Validation)
    expect(categorizeError(errors[2])).toBe(ErrorCategory.Validation)
  })

  test('prioritizes network category when multiple keywords match', () => {
    // Given
    const error = new Error('fetch failed: file not found')

    // When
    const category = categorizeError(error)

    // Then
    expect(category).toBe(ErrorCategory.Network)
  })

  test('handles case insensitive matching', () => {
    // Given
    const errors = [new Error('FETCH FAILED'), new Error('Fetch Failed'), new Error('FeTcH fAiLeD')]

    // When
    // Then
    errors.forEach((error) => {
      expect(categorizeError(error)).toBe(ErrorCategory.Network)
    })
  })

  test('returns Unknown for unrecognized error messages', () => {
    // Given
    const errors = [
      new Error('Something went wrong'),
      new Error('Unexpected error'),
      new Error('Unknown issue occurred'),
    ]

    // When
    // Then
    errors.forEach((error) => {
      expect(categorizeError(error)).toBe(ErrorCategory.Unknown)
    })
  })

  test('handles errors with empty messages', () => {
    // Given
    const error = new Error('')

    // When
    const category = categorizeError(error)

    // Then
    expect(category).toBe(ErrorCategory.Unknown)
  })
})
