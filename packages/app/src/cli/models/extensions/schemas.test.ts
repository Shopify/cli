import {BaseSchema, MAX_UID_LENGTH} from './schemas.js'
import {describe, expect, test} from 'vitest'

const validUIDTestCases = [
  ['valid-uid-123', 'UID with alphanumeric characters and hyphens'],
  ['validuid', 'UID with only letters'],
  ['123456', 'UID with only numbers'],
  ['valid-uid-with-many-hyphens', 'UID with multiple hyphens in the middle'],
  ['valid_uid', 'UID with underscore'],
  ['valid.uid', 'UID with dot'],
  ['valid()uid', 'UID with parentheses'],
  ['valid{}uid', 'UID with curly braces'],
  ['valid$uid', 'UID with dollar sign'],
  ['a'.repeat(MAX_UID_LENGTH), 'UID at maximum length'],
]

const invalidUIDTestCases = [
  ['', "UID can't be empty"],
  ['   ', "UID can't be empty"],
  ['a'.repeat(MAX_UID_LENGTH + 1), `UID can't exceed ${MAX_UID_LENGTH} characters`],
  ['a'.repeat(MAX_UID_LENGTH + 50), `UID can't exceed ${MAX_UID_LENGTH} characters`],
  ['invalid uid', 'UID can only contain alphanumeric characters and hyphens'],
  ['invalid@uid!', 'UID can only contain alphanumeric characters and hyphens'],
  ['invalid/uid', 'UID can only contain alphanumeric characters and hyphens'],
  ['-invalid-uid', "UID can't start or end with a hyphen"],
  ['invalid-uid-', "UID can't start or end with a hyphen"],
  ['-invalid-uid-', "UID can't start or end with a hyphen"],
  ['-', "UID can't start or end with a hyphen"],
  ['-----', "UID can't start or end with a hyphen"],
]

describe('UIDSchema', () => {
  describe('valid UIDs', () => {
    test.each(validUIDTestCases)('accepts %s (%s)', (uid) => {
      const result = BaseSchema.safeParse({uid})
      expect(result.success).toBe(true)
    })

    test('trims whitespace from UID', () => {
      const result = BaseSchema.safeParse({uid: '  valid-uid  '})
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.uid).toBe('valid-uid')
      }
    })
  })

  describe('invalid UIDs', () => {
    test.each(invalidUIDTestCases)('rejects "%s" with error: %s', (uid, expectedError) => {
      const result = BaseSchema.safeParse({uid})
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(expectedError)
      }
    })
  })
})
