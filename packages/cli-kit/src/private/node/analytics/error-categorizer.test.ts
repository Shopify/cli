import {categorizeError, formatErrorMessage, ErrorCategory} from './error-categorizer.js'
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

describe('formatErrorMessage', () => {
  describe('Network errors', () => {
    test('preserves HTTP status codes', () => {
      // Given
      const error = new Error('Request failed with status 404')
      const category = ErrorCategory.Network

      // When
      const formatted = formatErrorMessage(error, category)

      // Then
      expect(formatted).toBe('http-404-request-failed-with-status')
    })

    test('preserves GraphQL error codes', () => {
      // Given
      const error = new Error('GraphQL Error (Code: 401): Unauthorized')
      const category = ErrorCategory.Network

      // When
      const formatted = formatErrorMessage(error, category)

      // Then
      expect(formatted).toBe('http-401-graphql-error-code-unauthorized')
    })

    test('preserves connection error codes', () => {
      // Given
      const error = new Error('ECONNREFUSED: connection refused')
      const category = ErrorCategory.Network

      // When
      const formatted = formatErrorMessage(error, category)

      // Then
      expect(formatted).toBe('http-000-econnrefused-econnrefused-connection-refu')
    })

    test('handles network errors without specific codes', () => {
      // Given
      const error = new Error('Network request failed')
      const category = ErrorCategory.Network

      // When
      const formatted = formatErrorMessage(error, category)

      // Then
      expect(formatted).toBe('http-000-network-request-failed')
    })
  })

  describe('Authentication errors', () => {
    test('uses generic formatting', () => {
      // Given
      const error = new Error('Unauthorized access: 401')
      const category = ErrorCategory.Authentication

      // When
      const formatted = formatErrorMessage(error, category)

      // Then
      expect(formatted).toBe('unauthorized-access-401')
    })

    test('handles auth errors without status codes', () => {
      // Given
      const error = new Error('Invalid credentials provided')
      const category = ErrorCategory.Authentication

      // When
      const formatted = formatErrorMessage(error, category)

      // Then
      expect(formatted).toBe('invalid-credentials-provided')
    })
  })

  describe('File system errors', () => {
    test('uses generic formatting', () => {
      // Given
      const error = new Error('ENOENT: no such file or directory')
      const category = ErrorCategory.FileSystem

      // When
      const formatted = formatErrorMessage(error, category)

      // Then
      expect(formatted).toBe('enoent-no-such-file-or-directory')
    })

    test('handles file system errors without error codes', () => {
      // Given
      const error = new Error('Cannot read directory')
      const category = ErrorCategory.FileSystem

      // When
      const formatted = formatErrorMessage(error, category)

      // Then
      expect(formatted).toBe('cannot-read-directory')
    })
  })

  describe('Rate limit errors', () => {
    test('uses generic formatting', () => {
      // Given
      const error = new Error('Rate limit exceeded: 100 requests per minute')
      const category = ErrorCategory.RateLimit

      // When
      const formatted = formatErrorMessage(error, category)

      // Then
      expect(formatted).toBe('rate-limit-exceeded-100-requests-per-minute')
    })

    test('handles rate limit errors without numbers', () => {
      // Given
      const error = new Error('Too many requests')
      const category = ErrorCategory.RateLimit

      // When
      const formatted = formatErrorMessage(error, category)

      // Then
      expect(formatted).toBe('too-many-requests')
    })
  })

  describe('JSON errors', () => {
    test('uses generic formatting', () => {
      // Given
      const error = new Error('Syntax error at line 42: unexpected token')
      const category = ErrorCategory.Json

      // When
      const formatted = formatErrorMessage(error, category)

      // Then
      expect(formatted).toBe('syntax-error-at-line-42-unexpected-token')
    })

    test('handles JSON errors without position info', () => {
      // Given
      const error = new Error('Invalid JSON received')
      const category = ErrorCategory.Json

      // When
      const formatted = formatErrorMessage(error, category)

      // Then
      expect(formatted).toBe('invalid-json-received')
    })
  })

  describe('Validation errors', () => {
    test('uses generic formatting', () => {
      // Given
      const error = new Error('Validation failed for field: username')
      const category = ErrorCategory.Validation

      // When
      const formatted = formatErrorMessage(error, category)

      // Then
      expect(formatted).toBe('validation-failed-for-field-username')
    })

    test('handles validation errors without field names', () => {
      // Given
      const error = new Error('Required field missing')
      const category = ErrorCategory.Validation

      // When
      const formatted = formatErrorMessage(error, category)

      // Then
      expect(formatted).toBe('required-field-missing')
    })
  })

  describe('Permission errors', () => {
    test('uses generic formatting', () => {
      // Given
      const error = new Error('Permission denied to /etc/config')
      const category = ErrorCategory.Permission

      // When
      const formatted = formatErrorMessage(error, category)

      // Then
      expect(formatted).toBe('permission-denied-to-etc-config')
    })

    test('handles permission errors without resource names', () => {
      // Given
      const error = new Error('Access denied')
      const category = ErrorCategory.Permission

      // When
      const formatted = formatErrorMessage(error, category)

      // Then
      expect(formatted).toBe('access-denied')
    })
  })

  describe('Liquid errors', () => {
    test('uses generic formatting', () => {
      // Given
      const error = new Error('Liquid syntax error at line 15')
      const category = ErrorCategory.Liquid

      // When
      const formatted = formatErrorMessage(error, category)

      // Then
      expect(formatted).toBe('liquid-syntax-error-at-line-15')
    })

    test('handles Liquid errors without line numbers', () => {
      // Given
      const error = new Error('Liquid template error')
      const category = ErrorCategory.Liquid

      // When
      const formatted = formatErrorMessage(error, category)

      // Then
      expect(formatted).toBe('liquid-template-error')
    })
  })

  describe('Theme check errors', () => {
    test('uses generic formatting', () => {
      // Given
      const error = new Error('Theme check failed for rule: missing-alt-text')
      const category = ErrorCategory.ThemeCheck

      // When
      const formatted = formatErrorMessage(error, category)

      // Then
      expect(formatted).toBe('theme-check-failed-for-rule-missing-alt-text')
    })

    test('handles theme check errors without rule names', () => {
      // Given
      const error = new Error('Theme validation failed')
      const category = ErrorCategory.ThemeCheck

      // When
      const formatted = formatErrorMessage(error, category)

      // Then
      expect(formatted).toBe('theme-validation-failed')
    })
  })

  describe('Unknown errors', () => {
    test('uses generic formatting', () => {
      // Given
      const error = new Error('Something went wrong')
      const category = ErrorCategory.Unknown

      // When
      const formatted = formatErrorMessage(error, category)

      // Then
      expect(formatted).toBe('something-went-wrong')
    })
  })

  describe('Edge cases', () => {
    test('handles very long error messages', () => {
      // Given
      const longMessage = 'A'.repeat(100)
      const error = new Error(longMessage)
      const category = ErrorCategory.Network

      // When
      const formatted = formatErrorMessage(error, category)

      // Then
      expect(formatted.length).toBeLessThanOrEqual(50)
      expect(formatted).toBe(`http-000-${'a'.repeat(41)}`)
    })

    test('handles non-Error objects', () => {
      // Given
      const error = 'String error message'
      const category = ErrorCategory.Unknown

      // When
      const formatted = formatErrorMessage(error, category)

      // Then
      expect(formatted).toBe('string-error-message')
    })

    test('handles errors with special characters', () => {
      // Given
      const error = new Error('Error: @#$%^&*()!')
      const category = ErrorCategory.Unknown

      // When
      const formatted = formatErrorMessage(error, category)

      // Then
      expect(formatted).toBe('error')
    })

    test('removes consecutive dashes', () => {
      // Given
      const error = new Error('Error---with---many---dashes')
      const category = ErrorCategory.Unknown

      // When
      const formatted = formatErrorMessage(error, category)

      // Then
      expect(formatted).toBe('error-with-many-dashes')
    })

    test('trims leading and trailing dashes', () => {
      // Given
      const error = new Error('---Error message---')
      const category = ErrorCategory.Unknown

      // When
      const formatted = formatErrorMessage(error, category)

      // Then
      expect(formatted).toBe('error-message')
    })
  })
})
