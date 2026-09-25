import {CLI_KIT_VERSION} from './version.js'
import {describe, expect, test} from 'vitest'

describe('CLI_KIT_VERSION', () => {
  test('exports a valid semver version string', () => {
    expect(typeof CLI_KIT_VERSION).toBe('string')
    expect(CLI_KIT_VERSION).toMatch(/^\d+\.\d+\.\d+/)
  })
})
