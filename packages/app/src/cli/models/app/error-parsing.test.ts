import {parseStructuredErrors} from './error-parsing.js'
import {describe, expect, test} from 'vitest'

describe('parseStructuredErrors', () => {
  test('converts regular issues to structured format', () => {
    const issues = [
      {path: ['name'], message: 'Required', code: 'invalid_type'},
      {path: ['version'], message: 'Must be a string', code: 'invalid_type'},
    ]

    const result = parseStructuredErrors(issues)

    expect(result).toEqual([
      {path: ['name'], message: 'Required', code: 'invalid_type'},
      {path: ['version'], message: 'Must be a string', code: 'invalid_type'},
    ])
  })

  test('selects best union variant based on scoring', () => {
    const issues = [
      {
        code: 'invalid_union',
        unionErrors: [
          {
            issues: [
              {path: ['supports_moto'], message: 'Required'},
              {path: ['merchant_label'], message: 'Required'},
            ],
            name: 'ZodError',
          },
          {
            issues: [
              {path: ['type'], message: 'Expected string, received number'},
              {path: ['id'], message: 'Expected number, received string'},
            ],
            name: 'ZodError',
          },
        ],
        path: [],
        message: 'Invalid input',
      },
    ]

    const result = parseStructuredErrors(issues)

    expect(result).toEqual([
      {path: ['supports_moto'], message: 'Required', code: 'invalid_union'},
      {path: ['merchant_label'], message: 'Required', code: 'invalid_union'},
    ])
  })

  test('falls back when all union variants have empty issues', () => {
    const issues = [
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

    const result = parseStructuredErrors(issues)

    expect(result).toEqual([{path: ['root'], message: 'Invalid input', code: 'invalid_union'}])
  })

  test('falls back when union has no unionErrors array', () => {
    const issues = [
      {
        code: 'invalid_union',
        path: ['field'],
        message: 'Invalid input',
      },
    ]

    const result = parseStructuredErrors(issues)

    expect(result).toEqual([{path: ['field'], message: 'Invalid input', code: 'invalid_union'}])
  })

  test('handles missing message with fallback', () => {
    const issues = [{path: ['x'], code: 'custom'}]

    const result = parseStructuredErrors(issues)

    expect(result).toEqual([{path: ['x'], message: 'Unknown error', code: 'custom'}])
  })
})
