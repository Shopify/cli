import {
  DevelopmentThemeManager,
  NO_DEVELOPMENT_THEME_ID_SET,
  DEVELOPMENT_THEME_NOT_FOUND,
} from './development-theme-manager.js'
import {getDevelopmentTheme, setDevelopmentTheme, removeDevelopmentTheme} from '../services/local-storage.js'
import {themeCreate, fetchTheme} from '@shopify/cli-kit/node/themes/api'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {beforeEach, describe, expect, vi, test} from 'vitest'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {DEVELOPMENT_THEME_ROLE} from '@shopify/cli-kit/node/themes/utils'

vi.mock('@shopify/cli-kit/node/themes/api')
vi.mock('../services/local-storage.js')

describe('DevelopmentThemeManager', () => {
  const storeFqdn = 'mystore.myshopify.com'
  const token = 'token'
  const existingId = 200
  const newThemeId = 201
  const onlyLocallyExistingId = 404
  const themeTestDatabase: {[id: number]: Theme | undefined} = {
    [existingId]: {id: existingId} as Theme,
    [onlyLocallyExistingId]: undefined,
  }
  let localDevelopmentThemeId: string | undefined

  beforeEach(() => {
    vi.mocked(getDevelopmentTheme).mockImplementation(() => localDevelopmentThemeId)
    vi.mocked(setDevelopmentTheme).mockImplementation(() => undefined)
    vi.mocked(removeDevelopmentTheme).mockImplementation(() => undefined)

    vi.mocked(fetchTheme).mockImplementation((id: number) => Promise.resolve(themeTestDatabase[id]))
    vi.mocked(themeCreate).mockImplementation(({name, role}) =>
      Promise.resolve(
        buildTheme({
          id: newThemeId,
          name: name!,
          role: role!,
        })!,
      ),
    )
  })

  function buildDevelopmentThemeManager() {
    return new DevelopmentThemeManager({
      storeFqdn,
      token,
    })
  }

  describe('find', () => {
    test('should throw Abort if no ID is locally stored', async () => {
      // Given
      localDevelopmentThemeId = undefined

      // When
      // Then
      await expect(() => buildDevelopmentThemeManager().find()).rejects.toThrowError(NO_DEVELOPMENT_THEME_ID_SET)
      expect(removeDevelopmentTheme).not.toHaveBeenCalled()
    })

    test('should remove locally stored ID and throw Abort if API could not return theme', async () => {
      // Given
      const theme = onlyLocallyExistingId.toString()
      localDevelopmentThemeId = theme

      // When
      // Then
      await expect(() => buildDevelopmentThemeManager().find()).rejects.toThrowError(DEVELOPMENT_THEME_NOT_FOUND(theme))
      expect(removeDevelopmentTheme).toHaveBeenCalledOnce()
    })

    test('should return theme if API returns theme with locally stored ID', async () => {
      const theme = existingId.toString()
      localDevelopmentThemeId = theme
      await expect(buildDevelopmentThemeManager().find()).resolves.toEqual(themeTestDatabase[existingId])
    })
  })

  describe('findOrCreate', () => {
    test('should not create a new development theme if API returns theme with locally stored ID', async () => {
      // Given
      const theme = existingId.toString()
      localDevelopmentThemeId = theme

      // When
      // Then
      expect((await buildDevelopmentThemeManager().findOrCreate()).id.toString()).toEqual(theme)
    })

    test('should create a new development theme if no ID is locally stored', async () => {
      // Given
      localDevelopmentThemeId = undefined

      // When
      // Then
      expect((await buildDevelopmentThemeManager().findOrCreate()).id.toString()).toEqual(newThemeId.toString())
      expect(removeDevelopmentTheme).not.toHaveBeenCalled()
    })

    test('should create a new development theme if locally existing ID points to nowhere', async () => {
      // Given
      const theme = onlyLocallyExistingId.toString()
      localDevelopmentThemeId = theme

      // When
      // Then
      expect((await buildDevelopmentThemeManager().findOrCreate()).id.toString()).toEqual(newThemeId.toString())
      expect(removeDevelopmentTheme).toHaveBeenCalledOnce()
    })
  })

  describe('create', () => {
    test('should create a new development theme', async () => {
      // Given
      const developmentThemeManager = buildDevelopmentThemeManager()

      // When
      const theme = await developmentThemeManager.create()

      // Then
      expect(theme.role).toBe(DEVELOPMENT_THEME_ROLE)
    })
  })
})
