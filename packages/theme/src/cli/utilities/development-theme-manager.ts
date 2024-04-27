import {getDevelopmentTheme, setDevelopmentTheme, removeDevelopmentTheme} from '../services/local-storage.js'
import {ThemeManager} from '@shopify/cli-kit/node/themes/theme-manager'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {DEVELOPMENT_THEME_ROLE} from '@shopify/cli-kit/node/themes/utils'

export const DEVELOPMENT_THEME_NOT_FOUND = (themeId: string) =>
  `Development theme #${themeId} could not be found. Please create a new development theme.`
export const NO_DEVELOPMENT_THEME_ID_SET =
  'No development theme ID has been set. Please create a development theme first.'
export const UNEXPECTED_ROLE_VALUE =
  'There was an issue finding your development theme. Please create a new one using `theme dev` or `theme push -d`.'

export class DevelopmentThemeManager extends ThemeManager {
  protected context = 'Development'

  constructor(adminSession: AdminSession) {
    super(adminSession)
    this.themeId = getDevelopmentTheme()
  }

  async findOrCreate(): Promise<Theme> {
    const theme = await super.findOrCreate()
    this.checkThemeRole(theme)
    return theme
  }

  async find(): Promise<Theme> {
    const theme = await this.fetch()
    if (!theme) {
      throw new AbortError(this.themeId ? DEVELOPMENT_THEME_NOT_FOUND(this.themeId) : NO_DEVELOPMENT_THEME_ID_SET)
    }
    this.checkThemeRole(theme)
    return theme
  }

  protected setTheme(themeId: string): void {
    setDevelopmentTheme(themeId)
  }

  protected removeTheme(): void {
    removeDevelopmentTheme()
  }

  private checkThemeRole(theme: Theme) {
    if (theme.role !== DEVELOPMENT_THEME_ROLE) {
      this.removeTheme()
      throw new AbortError(UNEXPECTED_ROLE_VALUE)
    }
  }
}
