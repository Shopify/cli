import {validateThemePassword} from './flags-validation.js'
import {describe, expect, test} from 'vitest'
import {AbortError} from '@shopify/cli-kit/node/error'

describe('validateThemePassword', () => {
  describe('valid cases', () => {
    test('should not throw when password is undefined or empty string', () => {
      expect(() => validateThemePassword(undefined)).not.toThrow()
      expect(() => validateThemePassword('')).not.toThrow()
    })

    test('should not throw when password starts with shptka_', () => {
      expect(() => validateThemePassword('shptka_valid_token')).not.toThrow()
      expect(() => validateThemePassword('shptka_')).not.toThrow()
      expect(() => validateThemePassword('shptka_abc123')).not.toThrow()
    })
  })

  describe('invalid cases', () => {
    test('should throw AbortError when password does not start with shptka_', () => {
      expect(() => validateThemePassword('valid-password')).toThrow(AbortError)
      expect(() => validateThemePassword('theme_token_123')).toThrow(AbortError)
      expect(() => validateThemePassword('shpat_abc123def456')).toThrow(AbortError)
    })

    test('should throw when shptka_ appears but not at the start', () => {
      expect(() => validateThemePassword('prefix_shptka_suffix')).toThrow(AbortError)
      expect(() => validateThemePassword('some_shptka_token')).toThrow(AbortError)
    })

    test('should throw correct error message for non-shptka_ passwords', () => {
      expect(() => validateThemePassword('invalid_token')).toThrow(
        'Invalid password. Please generate a new password from the Theme Access app.',
      )
    })
  })
})
