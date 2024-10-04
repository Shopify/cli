import {configureCLIEnvironment} from './cli-config.js'
import {describe, expect, beforeEach, afterAll, test} from 'vitest'

describe('configureCLIEnvironment', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = {...originalEnv}
  })

  afterAll(() => {
    process.env = originalEnv
  })

  describe('verbose', () => {
    test('sets DEBUG environment variable to * when verbose is true', () => {
      // Given
      delete process.env.DEBUG

      // When
      configureCLIEnvironment({verbose: true})

      // Then
      expect(process.env.DEBUG).toBe('*')
    })

    test('does not overwrite existing DEBUG value when verbose is true', () => {
      // Given
      process.env.DEBUG = 'existing-value'

      // When
      configureCLIEnvironment({verbose: true})

      // Then
      expect(process.env.DEBUG).toBe('existing-value')
    })

    test('does not set DEBUG environment variable when verbose is false', () => {
      // Given
      delete process.env.DEBUG

      // When
      configureCLIEnvironment({verbose: false})

      // Then
      expect(process.env.DEBUG).toBeUndefined()
    })
  })

  describe('noColor', () => {
    test('sets FORCE_COLOR to 0 when noColor is true', () => {
      // Given
      delete process.env.FORCE_COLOR

      // When
      configureCLIEnvironment({noColor: true})

      // Then
      expect(process.env.FORCE_COLOR).toBe('0')
    })

    test('does not set FORCE_COLOR when noColor is false', () => {
      // Given
      delete process.env.FORCE_COLOR

      // When
      configureCLIEnvironment({noColor: false})

      // Then
      expect(process.env.FORCE_COLOR).toBeUndefined()
    })
  })
})
