import {parseHumanReadableError} from './error-parsing.js'
import {describe, expect, test} from 'vitest'

describe('parseHumanReadableError', () => {
  test('formats union errors with smart variant detection', () => {
    const unionErrorObject = [
      {
        code: 'invalid_union',
        unionErrors: [
          {
            issues: [
              {
                code: 'invalid_type',
                expected: 'array',
                received: 'number',
                path: ['web', 'roles'],
                message: 'Expected array, received number',
              },
              {
                code: 'invalid_type',
                expected: 'string',
                received: 'undefined',
                path: ['web', 'commands', 'build'],
                message: 'Required',
              },
            ],
            name: 'ZodError',
          },
          {
            issues: [
              {
                code: 'invalid_literal',
                expected: "'frontend'",
                received: 'number',
                path: ['web', 'type'],
                message: "Invalid literal value, expected 'frontend'",
              },
            ],
            name: 'ZodError',
          },
        ],
        path: ['web'],
        message: 'Invalid input',
      },
    ]

    const result = parseHumanReadableError(unionErrorObject)

    // Verify the enhanced format shows only the best matching variant's errors
    // (Option 1 has both missing field + type error, so it's likely the intended one)
    expect(result).toContain('[web.roles]: Expected array, received number')
    expect(result).toContain('[web.commands.build]: Required')

    // Should NOT show confusing union variant breakdown
    expect(result).not.toContain('Union validation failed')
    expect(result).not.toContain('Option 1:')
    expect(result).not.toContain('Option 2:')

    // Should NOT show errors from the less likely option 2
    expect(result).not.toContain("[web.type]: Invalid literal value, expected 'frontend'")
  })

  test('handles regular non-union errors', () => {
    const regularErrorObject = [
      {
        path: ['name'],
        message: 'Required field is missing',
      },
      {
        path: ['version'],
        message: 'Must be a valid semver string',
      },
    ]

    const result = parseHumanReadableError(regularErrorObject)

    // Verify regular errors still work as expected
    expect(result).toBe('• [name]: Required field is missing\n• [version]: Must be a valid semver string\n')
    expect(result).not.toContain('Union validation failed')
  })

  test('handles edge cases for union error detection', () => {
    // Test case 1: Union error with no unionErrors array
    const noUnionErrors = [
      {
        code: 'invalid_union',
        path: ['root'],
        message: 'Invalid input',
      },
    ]

    const result1 = parseHumanReadableError(noUnionErrors)
    expect(result1).toBe('• [root]: Invalid input\n')

    // Test case 2: Union error with empty unionErrors array - should fall back to showing full union error
    const emptyUnionErrors = [
      {
        code: 'invalid_union',
        unionErrors: [],
        path: ['root'],
        message: 'Invalid input',
      },
    ]

    const result2 = parseHumanReadableError(emptyUnionErrors)
    expect(result2).toContain("Configuration doesn't match any expected format:")

    // Test case 3: Union errors with variants that have no issues - results in empty string
    const noIssuesVariants = [
      {
        code: 'invalid_union',
        unionErrors: [
          {issues: [], name: 'ZodError'},
          {issues: [], name: 'ZodError'},
        ],
        path: ['root'],
        message: 'Invalid input',
      },
    ]

    const result3 = parseHumanReadableError(noIssuesVariants)
    // When all variants have no issues, the best variant selection returns null issues
    // resulting in no output, which falls back to the union error display
    expect(result3).toContain("Configuration doesn't match any expected format:")
  })

  test('findBestMatchingVariant scoring logic works correctly', () => {
    // Test various scoring scenarios by creating mock union errors
    const scenarioWithMissingFields = [
      {
        code: 'invalid_union',
        unionErrors: [
          {
            // Variant with missing fields - should score highest
            issues: [
              {path: ['supports_moto'], message: 'Required'},
              {path: ['merchant_label'], message: 'Required'},
            ],
            name: 'ZodError',
          },
          {
            // Variant with only type errors - should score lower
            issues: [
              {path: ['type'], message: 'Expected string, received number'},
              {path: ['id'], message: 'Expected number, received string'},
            ],
            name: 'ZodError',
          },
          {
            // Variant with other errors - should score lowest
            issues: [{path: ['url'], message: 'Invalid URL format'}],
            name: 'ZodError',
          },
        ],
        path: [],
        message: 'Invalid input',
      },
    ]

    const result = parseHumanReadableError(scenarioWithMissingFields)

    // Should show only the variant with missing fields (highest score)
    expect(result).toContain('[supports_moto]: Required')
    expect(result).toContain('[merchant_label]: Required')

    // Should NOT show errors from other variants
    expect(result).not.toContain('Expected string, received number')
    expect(result).not.toContain('Invalid URL format')
    expect(result).not.toContain('Union validation failed')
  })

  test('handles undefined messages gracefully', () => {
    const undefinedMessageError = [
      {
        path: ['field'],
        message: undefined,
      },
      {
        path: [],
        // message is completely missing
      },
    ]

    const result = parseHumanReadableError(undefinedMessageError)

    expect(result).toBe('• [field]: Unknown error\n• [root]: Unknown error\n')
  })

  test('handles mixed scoring scenarios', () => {
    // Test scenario where we need to pick between variants with different error combinations
    const mixedScenario = [
      {
        code: 'invalid_union',
        unionErrors: [
          {
            // Mix of missing fields and type errors - this should win due to missing fields
            issues: [
              {path: ['required_field'], message: 'Required'},
              {path: ['wrong_type'], message: 'Expected string, received number'},
            ],
            name: 'ZodError',
          },
          {
            // Only type errors - should lose
            issues: [
              {path: ['field1'], message: 'Expected boolean, received string'},
              {path: ['field2'], message: 'Expected array, received object'},
              {path: ['field3'], message: 'Expected number, received string'},
            ],
            name: 'ZodError',
          },
          {
            // Only other validation errors - should score lowest
            issues: [
              {path: ['url'], message: 'Must be valid URL'},
              {path: ['email'], message: 'Must be valid email'},
            ],
            name: 'ZodError',
          },
        ],
        path: [],
        message: 'Invalid input',
      },
    ]

    const result = parseHumanReadableError(mixedScenario)

    // Should pick the variant with missing field (even though it has fewer total errors)
    expect(result).toContain('[required_field]: Required')
    expect(result).toContain('[wrong_type]: Expected string, received number')

    // Should not show errors from other variants
    expect(result).not.toContain('Expected boolean, received string')
    expect(result).not.toContain('Must be valid URL')
    expect(result).not.toContain('Union validation failed')
  })
})
