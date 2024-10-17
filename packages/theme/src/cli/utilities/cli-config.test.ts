import {configureCLIEnvironment} from './cli-config.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import colors from '@shopify/cli-kit/node/colors'
import {describe, expect, beforeEach, afterAll, test} from 'vitest'

describe('configureCLIEnvironment', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = {...originalEnv}
    colors.level = 1
  })

  afterAll(() => {
    process.env = originalEnv
  })

  describe('verbose', () => {
    test('sets verbose environment variable when verbose is true', () => {
      // Given
      delete process.env[globalFlags.verbose.env!]

      // When
      configureCLIEnvironment({verbose: true})

      // Then
      expect(process.env[globalFlags.verbose.env!]).toBe('true')
    })

    test('does not set verbose environment variable when verbose is false', () => {
      // Given
      delete process.env[globalFlags.verbose.env!]

      // When
      configureCLIEnvironment({verbose: false})

      // Then
      expect(process.env[globalFlags.verbose.env!]).toBeUndefined()
    })
  })

  describe('noColor', () => {
    test('sets no-color environment variable when noColor is true', () => {
      // Given
      delete process.env[globalFlags['no-color'].env!]

      // When
      configureCLIEnvironment({noColor: true})

      // Then
      expect(colors.level).toBe(0)
      expect(process.env.FORCE_COLOR).toBe('0')
    })

    test('does not set no-color environment variable when noColor is false', () => {
      // Given
      delete process.env[globalFlags['no-color'].env!]

      // When
      configureCLIEnvironment({noColor: false})

      // Then
      expect(colors.level).toBe(1)
      expect(process.env.FORCE_COLOR).toBe('1')
    })
  })
})
