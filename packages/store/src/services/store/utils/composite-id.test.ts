import {serialize, deserialize, type CompositeIdComponents} from './composite-id.js'
import {describe, expect, test} from 'vitest'

describe('composite-id', () => {
  describe('serialize', () => {
    test('serializes operation with valid components', () => {
      const components: CompositeIdComponents = {
        operationType: 'copy',
        organizationId: 789,
        bulkOperationId: 'COPY_OP_ID',
      }

      const result = serialize(components)
      const expected = Buffer.from('copy:789:COPY_OP_ID').toString('base64')

      expect(result).toBe(expected)
    })
  })

  describe('deserialize', () => {
    test('deserializes valid composite ID', () => {
      const compositeId = Buffer.from('copy:789:COPY_OP_ID').toString('base64')

      const result = deserialize(compositeId)

      expect(result).toEqual({
        operationType: 'copy',
        organizationId: 789,
        bulkOperationId: 'COPY_OP_ID',
      })
    })

    test('throws error for invalid base64', () => {
      const invalidBase64 = 'not-valid-base64!'

      expect(() => deserialize(invalidBase64)).toThrow('Invalid composite ID format')
    })

    test('throws error for missing parts', () => {
      const compositeId = Buffer.from('import:123').toString('base64')

      expect(() => deserialize(compositeId)).toThrow('Invalid composite ID format')
    })

    test('throws error for too many parts', () => {
      const compositeId = Buffer.from('import:123:BULK_ID:extra').toString('base64')

      expect(() => deserialize(compositeId)).toThrow('Invalid composite ID format')
    })

    test('throws error for invalid operation type', () => {
      const compositeId = Buffer.from('invalid:123:BULK_ID').toString('base64')

      expect(() => deserialize(compositeId)).toThrow('Invalid operation type: invalid')
    })

    test('throws error for invalid organization ID', () => {
      const compositeId = Buffer.from('import:not-a-number:BULK_ID').toString('base64')

      expect(() => deserialize(compositeId)).toThrow('Invalid organization ID: not-a-number')
    })

    test('throws error for empty bulk operation ID', () => {
      const compositeId = Buffer.from('import:123:').toString('base64')

      expect(() => deserialize(compositeId)).toThrow("Bulk operation ID can't be empty")
    })
  })

  describe('serialize->deserializeroundtrip', () => {
    test('serialize then deserialize returns original components', () => {
      const original: CompositeIdComponents = {
        operationType: 'import',
        organizationId: 123,
        bulkOperationId: '24DKZ25JFHSOIF52D',
      }

      expect(deserialize(serialize(original))).toEqual(original)
    })
  })
})
