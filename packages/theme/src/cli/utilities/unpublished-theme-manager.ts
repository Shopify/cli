import {AdminSession} from '@shopify/cli-kit/node/session'
import {ThemeManager} from '@shopify/cli-kit/node/themes/theme-manager'
import {Role, UNPUBLISHED_THEME_ROLE} from '@shopify/cli-kit/node/themes/utils'

export class UnpublishedThemeManager extends ThemeManager {
  protected context = 'Theme'

  constructor(adminSession: AdminSession) {
    super(adminSession)
  }

  async create(themeRole?: Role, themeName?: string) {
    const role = themeRole || UNPUBLISHED_THEME_ROLE
    return super.create(role, themeName)
  }

  protected setTheme(themeId: string): void {
    this.themeId = themeId
  }

  protected removeTheme(): void {
    this.themeId = undefined
  }
}
