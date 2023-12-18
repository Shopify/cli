import {getDevelopmentTheme, setDevelopmentTheme, removeDevelopmentTheme} from '../services/local-storage.js'
import {ThemeManager} from '@shopify/cli-kit/node/themes/theme-manager'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'
import {Theme} from '@shopify/cli-kit/node/themes/types'

export const DEVELOPMENT_THEME_NOT_FOUND = (themeId: string) =>
  `Development theme #${themeId} could not be found. Please create a new development theme.`
export const NO_DEVELOPMENT_THEME_ID_SET =
  'No development theme ID has been set. Please create a development theme first.'

export class DevelopmentThemeManager extends ThemeManager {
  protected context = 'Development'

  constructor(adminSession: AdminSession) {
    super(adminSession)
    this.themeId = getDevelopmentTheme()
  }

  async find(): Promise<Theme> {
    const theme = await this.fetch()
    if (!theme) {
      throw new AbortError(this.themeId ? DEVELOPMENT_THEME_NOT_FOUND(this.themeId) : NO_DEVELOPMENT_THEME_ID_SET)
    }
    return theme
  }

  protected setTheme(themeId: string): void {
    setDevelopmentTheme(themeId)
  }

  protected removeTheme(): void {
    removeDevelopmentTheme()
  }
}
