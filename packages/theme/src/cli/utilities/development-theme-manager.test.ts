import {
  DevelopmentThemeManager,
  NO_DEVELOPMENT_THEME_ID_SET,
  DEVELOPMENT_THEME_NOT_FOUND,
} from './development-theme-manager.js'
import {getDevelopmentTheme, setDevelopmentTheme, removeDevelopmentTheme} from '../services/local-storage.js'
import {createTheme, fetchTheme} from '@shopify/cli-kit/node/themes/themes-api'
import {Theme} from '@shopify/cli-kit/node/themes/models/theme'
import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/themes/themes-api')
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
    vi.mocked(createTheme).mockImplementation(({name, role}) =>
      Promise.resolve(new Theme(newThemeId, name as string, role as string)),
    )
  })

  function buildDevelopmentThemeManager() {
    return new DevelopmentThemeManager({
      storeFqdn,
      token,
    })
  }

  describe('find', () => {
    it('should throw Abort if no ID is locally stored', async () => {
      localDevelopmentThemeId = undefined
      await expect(() => buildDevelopmentThemeManager().find()).rejects.toThrowError(NO_DEVELOPMENT_THEME_ID_SET)
      expect(removeDevelopmentTheme).not.toHaveBeenCalled()
    })

    it('should remove locally stored ID and throw Abort if API could not return theme', async () => {
      const theme = onlyLocallyExistingId.toString()
      localDevelopmentThemeId = theme
      await expect(() => buildDevelopmentThemeManager().find()).rejects.toThrowError(DEVELOPMENT_THEME_NOT_FOUND(theme))
      expect(removeDevelopmentTheme).toHaveBeenCalledOnce()
    })

    it('should return theme if API returns theme with locally stored ID', async () => {
      const theme = existingId.toString()
      localDevelopmentThemeId = theme
      expect(await buildDevelopmentThemeManager().find()).toEqual(themeTestDatabase[existingId])
    })
  })

  describe('findOrCreate', () => {
    it('should not create a new development theme if API returns theme with locally stored ID', async () => {
      const theme = existingId.toString()
      localDevelopmentThemeId = theme
      expect((await buildDevelopmentThemeManager().findOrCreate()).id.toString()).toEqual(theme)
    })

    it('should create a new development theme if no ID is locally stored', async () => {
      localDevelopmentThemeId = undefined
      expect((await buildDevelopmentThemeManager().findOrCreate()).id.toString()).toEqual(newThemeId.toString())
      expect(removeDevelopmentTheme).not.toHaveBeenCalled()
    })

    it('should create a new development theme if locally existing ID points to nowhere', async () => {
      const theme = onlyLocallyExistingId.toString()
      localDevelopmentThemeId = theme
      expect((await buildDevelopmentThemeManager().findOrCreate()).id.toString()).toEqual(newThemeId.toString())
      expect(removeDevelopmentTheme).toHaveBeenCalledOnce()
    })
  })
})
