import {configureCLIEnvironment} from './cli-config.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import colors from '@shopify/cli-kit/node/colors'
import {afterEach, describe, expect, test, vi} from 'vitest'

const verboseEnvironmentVariable = globalFlags.verbose.env!

afterEach(() => {
  vi.unstubAllEnvs()
})

// chalk's level is a module-level singleton, so each test starts from colors enabled and restores it.
function withColorsEnabled(run: () => void): void {
  const originalLevel = colors.level
  colors.level = 1
  try {
    run()
  } finally {
    colors.level = originalLevel
  }
}

describe('configureCLIEnvironment', () => {
  describe('verbose', () => {
    test('sets verbose environment variable when verbose is true', () => {
      // Given
      vi.stubEnv(verboseEnvironmentVariable, undefined)

      // When
      configureCLIEnvironment({verbose: true})

      // Then
      expect(process.env[verboseEnvironmentVariable]).toBe('true')
    })

    test('does not set verbose environment variable when verbose is false', () => {
      // Given
      vi.stubEnv(verboseEnvironmentVariable, undefined)

      // When
      configureCLIEnvironment({verbose: false})

      // Then
      expect(process.env[verboseEnvironmentVariable]).toBeUndefined()
    })

    test('leaves an existing verbose environment variable untouched when verbose is false', () => {
      // Given
      vi.stubEnv(verboseEnvironmentVariable, 'true')

      // When
      configureCLIEnvironment({verbose: false})

      // Then
      expect(process.env[verboseEnvironmentVariable]).toBe('true')
    })
  })

  describe('noColor', () => {
    test('disables colors when noColor is true', () => {
      // Given
      vi.stubEnv('FORCE_COLOR', '1')

      withColorsEnabled(() => {
        // When
        configureCLIEnvironment({noColor: true})

        // Then
        expect(colors.level).toBe(0)
        expect(process.env.FORCE_COLOR).toBe('0')
      })
    })

    test('leaves colors enabled when noColor is false', () => {
      // Given
      vi.stubEnv('FORCE_COLOR', '1')

      withColorsEnabled(() => {
        // When
        configureCLIEnvironment({noColor: false})

        // Then
        expect(colors.level).toBe(1)
        expect(process.env.FORCE_COLOR).toBe('1')
      })
    })
  })

  test('applies verbose and noColor together', () => {
    // Given
    vi.stubEnv(verboseEnvironmentVariable, undefined)
    vi.stubEnv('FORCE_COLOR', '1')

    withColorsEnabled(() => {
      // When
      configureCLIEnvironment({verbose: true, noColor: true})

      // Then
      expect(process.env[verboseEnvironmentVariable]).toBe('true')
      expect(colors.level).toBe(0)
      expect(process.env.FORCE_COLOR).toBe('0')
    })
  })

  test('changes nothing when no options are set', () => {
    // Given
    vi.stubEnv(verboseEnvironmentVariable, undefined)
    vi.stubEnv('FORCE_COLOR', '1')

    withColorsEnabled(() => {
      // When
      configureCLIEnvironment({})

      // Then
      expect(process.env[verboseEnvironmentVariable]).toBeUndefined()
      expect(colors.level).toBe(1)
      expect(process.env.FORCE_COLOR).toBe('1')
    })
  })
})
