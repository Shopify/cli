import {isDevelopmentTheme, composeThemeGid, parseGid, promptThemeName} from './utils.js'
import {renderTextPrompt} from '../ui.js'
import {getRandomName} from '../../common/string.js'
import {describe, test, expect, vi} from 'vitest'

vi.mock('../ui.js')
vi.mock('../../common/string.js')

describe('theme utils', () => {
  describe('isDevelopmentTheme', () => {
    test('returns true if theme role is development', () => {
      const theme = {id: 123, name: 'dev-theme', role: 'development', processing: false, createdAtRuntime: false}
      expect(isDevelopmentTheme(theme)).toBe(true)
    })

    test('returns false if theme role is live', () => {
      const theme = {id: 123, name: 'live-theme', role: 'live', processing: false, createdAtRuntime: false}
      expect(isDevelopmentTheme(theme)).toBe(false)
    })

    test('returns false if theme role is unpublished', () => {
      const theme = {
        id: 123,
        name: 'unpublished-theme',
        role: 'unpublished',
        processing: false,
        createdAtRuntime: false,
      }
      expect(isDevelopmentTheme(theme)).toBe(false)
    })
  })

  describe('composeThemeGid', () => {
    test('composes GID from numerical ID', () => {
      expect(composeThemeGid(12345)).toBe('gid://shopify/OnlineStoreTheme/12345')
    })
  })

  describe('parseGid', () => {
    test('correctly extracts numerical ID from valid GID', () => {
      expect(parseGid('gid://shopify/OnlineStoreTheme/12345')).toBe(12345)
    })

    test('correctly extracts numerical ID from valid GID with different resource name', () => {
      expect(parseGid('gid://shopify/SomeOtherResource/98765')).toBe(98765)
    })

    test('throws an error if GID is invalid', () => {
      expect(() => parseGid('invalid-gid')).toThrow('Invalid GID: invalid-gid')
    })

    test('throws an error if GID does not end in digits', () => {
      expect(() => parseGid('gid://shopify/OnlineStoreTheme/abc')).toThrow(
        'Invalid GID: gid://shopify/OnlineStoreTheme/abc',
      )
    })
  })

  describe('promptThemeName', () => {
    test('generates default name and calls renderTextPrompt', async () => {
      vi.mocked(getRandomName).mockResolvedValue('creative-name')
      vi.mocked(renderTextPrompt).mockResolvedValue('user-chosen-name')

      const result = await promptThemeName('Please name your theme')

      expect(getRandomName).toHaveBeenCalledWith('creative')
      expect(renderTextPrompt).toHaveBeenCalledWith({
        message: 'Please name your theme',
        defaultValue: 'creative-name',
      })
      expect(result).toBe('user-chosen-name')
    })
  })
})
