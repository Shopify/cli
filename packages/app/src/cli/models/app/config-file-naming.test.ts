import {
  getAppConfigurationFileName,
  getAppConfigurationShorthand,
  isValidFormatAppConfigurationFileName,
} from './config-file-naming.js'
import {describe, expect, test} from 'vitest'

describe('getAppConfigurationFileName', () => {
  test('returns default filename when no config name is provided', () => {
    expect(getAppConfigurationFileName()).toBe('shopify.app.toml')
    expect(getAppConfigurationFileName(undefined)).toBe('shopify.app.toml')
  })

  test('returns the config name as-is when it matches the valid format', () => {
    expect(getAppConfigurationFileName('shopify.app.production.toml')).toBe('shopify.app.production.toml')
    expect(getAppConfigurationFileName('shopify.app.staging.toml')).toBe('shopify.app.staging.toml')
    expect(getAppConfigurationFileName('shopify.app.toml')).toBe('shopify.app.toml')
  })

  test('slugifies arbitrary strings into the filename pattern', () => {
    expect(getAppConfigurationFileName('production')).toBe('shopify.app.production.toml')
    expect(getAppConfigurationFileName('My Store')).toBe('shopify.app.my-store.toml')
  })
})

describe('getAppConfigurationShorthand', () => {
  test('returns undefined for the default config filename', () => {
    expect(getAppConfigurationShorthand('shopify.app.toml')).toBeUndefined()
    expect(getAppConfigurationShorthand('/some/path/shopify.app.toml')).toBeUndefined()
  })

  test('extracts the shorthand from a named config', () => {
    expect(getAppConfigurationShorthand('shopify.app.production.toml')).toBe('production')
    expect(getAppConfigurationShorthand('/path/to/shopify.app.staging.toml')).toBe('staging')
    expect(getAppConfigurationShorthand('shopify.app.my-store.toml')).toBe('my-store')
  })

  test('returns undefined for non-matching filenames', () => {
    expect(getAppConfigurationShorthand('random.toml')).toBeUndefined()
    expect(getAppConfigurationShorthand('shopify.web.toml')).toBeUndefined()
  })
})

describe('isValidFormatAppConfigurationFileName', () => {
  test('returns true for valid app configuration filenames', () => {
    expect(isValidFormatAppConfigurationFileName('shopify.app.toml')).toBe(true)
    expect(isValidFormatAppConfigurationFileName('shopify.app.production.toml')).toBe(true)
    expect(isValidFormatAppConfigurationFileName('shopify.app.my-store.toml')).toBe(true)
    expect(isValidFormatAppConfigurationFileName('shopify.app.test_env.toml')).toBe(true)
  })

  test('returns false for invalid filenames', () => {
    expect(isValidFormatAppConfigurationFileName('production')).toBe(false)
    expect(isValidFormatAppConfigurationFileName('shopify.web.toml')).toBe(false)
    expect(isValidFormatAppConfigurationFileName('shopify.app..toml')).toBe(false)
    expect(isValidFormatAppConfigurationFileName('')).toBe(false)
  })
})
