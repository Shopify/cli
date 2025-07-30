import {serialize, deserialize, type CompositeIdComponents} from './composite-id.js'
import {describe, expect, test} from 'vitest'

describe('composite-id', () => {
  describe('serialize', () => {
    test('serializes operation with valid components', () => {
      const components: CompositeIdComponents = {
        organizationId: 789,
        bulkDataOperationId: 'ZU23F985KFJH52',
      }

      const result = serialize(components)
      const expected = Buffer.from('789:ZU23F985KFJH52').toString('base64')

      expect(result).toBe(expected)
    })
  })

  describe('deserialize', () => {
    test('deserializes valid composite ID', () => {
      const compositeId = Buffer.from('789:ZU23F985KFJH52').toString('base64')

      const result = deserialize(compositeId)

      expect(result).toEqual({
        organizationId: 789,
        bulkDataOperationId: 'ZU23F985KFJH52',
      })
    })

    test('throws error for invalid base64', () => {
      const invalidBase64 = 'not-valid-base64!'

      expect(() => deserialize(invalidBase64)).toThrow('Invalid composite ID format')
    })

    test('throws error for missing parts', () => {
      const compositeId = Buffer.from('123').toString('base64')

      expect(() => deserialize(compositeId)).toThrow('Invalid composite ID format')
    })

    test('throws error for too many parts', () => {
      const compositeId = Buffer.from('123:BULK_ID:extra').toString('base64')

      expect(() => deserialize(compositeId)).toThrow('Invalid composite ID format')
    })

    test('throws error for invalid organization ID', () => {
      const compositeId = Buffer.from('not-a-number:BULK_ID').toString('base64')

      expect(() => deserialize(compositeId)).toThrow('Invalid organization ID: not-a-number')
    })

    test('throws error for empty bulk operation ID', () => {
      const compositeId = Buffer.from('123:').toString('base64')

      expect(() => deserialize(compositeId)).toThrow("Bulk operation ID can't be empty")
    })
  })

  describe('serialize->deserializeroundtrip', () => {
    test('serialize then deserialize returns original components', () => {
      const original: CompositeIdComponents = {
        organizationId: 123,
        bulkDataOperationId: '24DKZ25JFHSOIF52D',
      }

      expect(deserialize(serialize(original))).toEqual(original)
    })
  })
})
