import {
  DevelopmentThemeManager,
  NO_DEVELOPMENT_THEME_ID_SET,
  DEVELOPMENT_THEME_NOT_FOUND,
} from './development-theme-manager.js'
import {Theme} from '../models/theme.js'
import {describe, expect, it, SpyInstance, vi} from 'vitest'

describe('DevelopmentThemeManager', () => {
  const existingId = 200
  const newThemeId = 201
  const onlyLocallyExistingId = 404
  const themeTestDatabase: {[id: number]: Theme | undefined} = {
    [existingId]: {id: existingId} as Theme,
    [onlyLocallyExistingId]: undefined,
  }
  let developmentThemeManager: DevelopmentThemeManager
  let removeDevelopmentThemeSpy: SpyInstance

  function buildDevelopmentThemeManager(localDevelopmentThemeId?: string) {
    const store = 'mystore.myshopify.com'
    const token = 'token'
    const storage = {
      getDevelopmentTheme: () => localDevelopmentThemeId,
      setDevelopmentTheme: (theme: string) => undefined,
      removeDevelopmentTheme: () => undefined,
    }
    developmentThemeManager = new DevelopmentThemeManager(
      {
        storeFqdn: store,
        token,
      },
      storage,
      {
        fetchTheme: (id: number) => Promise.resolve(themeTestDatabase[id]),
        createTheme: ({name, role}) => Promise.resolve(new Theme(newThemeId, name as string, role as string)),
      },
    )
    removeDevelopmentThemeSpy = vi.spyOn(storage, 'removeDevelopmentTheme')
  }

  describe('find', () => {
    it('should throw Abort if no ID is locally stored', async () => {
      buildDevelopmentThemeManager()
      await expect(() => developmentThemeManager.find()).rejects.toThrowError(NO_DEVELOPMENT_THEME_ID_SET)
      expect(removeDevelopmentThemeSpy).not.toHaveBeenCalled()
    })

    it('should remove locally stored ID and throw Abort if API could not return theme', async () => {
      const theme = onlyLocallyExistingId.toString()
      buildDevelopmentThemeManager(theme)
      await expect(() => developmentThemeManager.find()).rejects.toThrowError(DEVELOPMENT_THEME_NOT_FOUND(theme))
      expect(removeDevelopmentThemeSpy).toHaveBeenCalledOnce()
    })

    it('should return theme if API returns theme with locally stored ID', async () => {
      const theme = existingId.toString()
      buildDevelopmentThemeManager(theme)
      expect(await developmentThemeManager.find()).toEqual(themeTestDatabase[existingId])
    })
  })

  describe('findOrCreate', () => {
    it('should not create a new development theme if API returns theme with locally stored ID', async () => {
      const theme = existingId.toString()
      buildDevelopmentThemeManager(theme)
      expect(await developmentThemeManager.findOrCreate()).toEqual(theme)
    })

    it('should create a new development theme if no ID is locally stored', async () => {
      buildDevelopmentThemeManager()
      expect(await developmentThemeManager.findOrCreate()).toEqual(newThemeId.toString())
      expect(removeDevelopmentThemeSpy).not.toHaveBeenCalled()
    })

    it('should create a new development theme if locally existing ID points to nowhere', async () => {
      const theme = onlyLocallyExistingId.toString()
      buildDevelopmentThemeManager(theme)
      expect(await developmentThemeManager.findOrCreate()).toEqual(newThemeId.toString())
      expect(removeDevelopmentThemeSpy).toHaveBeenCalledOnce()
    })
  })
})
