import {parseResourceConfigFlags} from './resource-config.js'
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
      const result = parseResourceConfigFlags(['products:handle', 'customers:email'])
      expect(result).toEqual({
        products: {
          identifier: {
            field: 'HANDLE',
            customId: undefined,
          },
        },
        customers: {
          identifier: {
            field: 'EMAIL',
            customId: undefined,
          },
        },
      })
    })

    test('overwrites identifier when same resource appears multiple times', () => {
      const result = parseResourceConfigFlags(['products:handle', 'products:title'])
      expect(result).toEqual({
        products: {
          identifier: {
            field: 'TITLE',
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
      const result = parseResourceConfigFlags(['products:metafield:custom:salesforce_id', 'customers:email'])
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
            field: 'EMAIL',
            customId: undefined,
          },
        },
      })
    })
  })
})
