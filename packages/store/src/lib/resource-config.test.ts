import {parseResourceConfigFlags} from './resource-config.js'
import {ValidationError, ErrorCodes} from '../services/store/errors/errors.js'
import {describe, expect, test} from 'vitest'

describe('parseResourceConfigFlags', () => {
  describe('when flags are empty or undefined', () => {
    test('returns empty object for empty array', () => {
      const result = parseResourceConfigFlags([])
      expect(result).toEqual({})
    })

    test('returns empty object for undefined', () => {
      const result = parseResourceConfigFlags(undefined as any)
      expect(result).toEqual({})
    })

    test('returns empty object for null', () => {
      const result = parseResourceConfigFlags(null as any)
      expect(result).toEqual({})
    })
  })

  describe('when parsing field-based resource configs', () => {
    test('parses single resource with field identifier', () => {
      const result = parseResourceConfigFlags(['products:handle'])
      expect(result).toEqual({
        products: {
          identifier: {
            field: 'HANDLE',
            customId: undefined,
          },
        },
      })
    })

    test('parses multiple different resources', () => {
      const result = parseResourceConfigFlags(['products:handle', 'customers:email_address'])
      expect(result).toEqual({
        products: {
          identifier: {
            field: 'HANDLE',
            customId: undefined,
          },
        },
        customers: {
          identifier: {
            field: 'EMAIL_ADDRESS',
            customId: undefined,
          },
        },
      })
    })

    test('overwrites identifier when same resource appears multiple times', () => {
      const result = parseResourceConfigFlags(['products:handle', 'products:id'])
      expect(result).toEqual({
        products: {
          identifier: {
            field: 'ID',
          },
        },
      })
    })
  })

  describe('when parsing metafield-based resource configs', () => {
    test('returns customId identifier for product unique metafield', () => {
      const result = parseResourceConfigFlags(['products:metafield:custom:salesforce_id'])
      expect(result).toEqual({
        products: {
          identifier: {
            customId: {
              namespace: 'custom',
              key: 'salesforce_id',
            },
          },
        },
      })
    })

    test('throws error for non-product unique metafield', () => {
      expect(() => parseResourceConfigFlags(['customers:metafield:custom:id'])).toThrow(
        "Invalid resource: customers don't support unique metafields as identifiers.",
      )
    })
  })

  describe('when parsing mixed field and metafield configs', () => {
    test('returns mixed set of identifier inputs', () => {
      const result = parseResourceConfigFlags(['products:metafield:custom:salesforce_id', 'customers:email_address'])
      expect(result).toEqual({
        products: {
          identifier: {
            field: undefined,
            customId: {
              namespace: 'custom',
              key: 'salesforce_id',
            },
          },
        },
        customers: {
          identifier: {
            field: 'EMAIL_ADDRESS',
            customId: undefined,
          },
        },
      })
    })
  })

  describe('when validating key formats and fields', () => {
    test('throws INVALID_KEY_FORMAT for malformed keys', () => {
      expect(() => parseResourceConfigFlags(['invalid'])).toThrow(ValidationError)
      expect(() => parseResourceConfigFlags(['invalid'])).toThrow(
        expect.objectContaining({
          code: ErrorCodes.INVALID_KEY_FORMAT,
        }),
      )

      expect(() => parseResourceConfigFlags(['product:yes:no'])).toThrow(ValidationError)
      expect(() => parseResourceConfigFlags(['product:yes:no'])).toThrow(
        expect.objectContaining({
          code: ErrorCodes.INVALID_KEY_FORMAT,
        }),
      )

      expect(() => parseResourceConfigFlags(['product/yes'])).toThrow(ValidationError)
      expect(() => parseResourceConfigFlags(['product/yes'])).toThrow(
        expect.objectContaining({
          code: ErrorCodes.INVALID_KEY_FORMAT,
        }),
      )
    })

    test('throws KEY_NOT_SUPPORTED for unknown resources', () => {
      expect(() => parseResourceConfigFlags(['unknown:field'])).toThrow(ValidationError)
      expect(() => parseResourceConfigFlags(['unknown:field'])).toThrow(
        expect.objectContaining({
          code: ErrorCodes.KEY_NOT_SUPPORTED,
        }),
      )
    })

    test('throws KEY_DOES_NOT_EXIST for invalid fields', () => {
      expect(() => parseResourceConfigFlags(['products:title'])).toThrow(ValidationError)
      expect(() => parseResourceConfigFlags(['products:title'])).toThrow(
        expect.objectContaining({
          code: ErrorCodes.KEY_DOES_NOT_EXIST,
        }),
      )
    })

    test('throws KEY_NOT_SUPPORTED for product typos', () => {
      expect(() => parseResourceConfigFlags(['product:handle'])).toThrow(ValidationError)
      expect(() => parseResourceConfigFlags(['product:handle'])).toThrow(
        expect.objectContaining({
          code: ErrorCodes.KEY_NOT_SUPPORTED,
        }),
      )
    })

    test('accepts valid resource:field combinations', () => {
      expect(() => parseResourceConfigFlags(['products:handle'])).not.toThrow()
      expect(() => parseResourceConfigFlags(['products:id'])).not.toThrow()
      expect(() => parseResourceConfigFlags(['customers:email_address'])).not.toThrow()
    })
  })
})
