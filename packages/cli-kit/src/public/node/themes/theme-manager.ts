import {fetchTheme, createTheme} from './themes-api.js'
import {DEVELOPMENT_THEME_ROLE, Theme} from './models/theme.js'
import {generateThemeName} from '../../../private/node/themes/generate-theme-name.js'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {BugError} from '@shopify/cli-kit/node/error'

export abstract class ThemeManager {
  protected themeId: string | undefined
  protected abstract setTheme(themeId: string): void
  protected abstract removeTheme(): void
  protected abstract context: string

  constructor(protected adminSession: AdminSession) {}

  async findOrCreate(): Promise<Theme> {
    let theme = await this.fetch()
    if (!theme) {
      theme = await this.create()
    }
    return theme
  }

  async fetch() {
    if (!this.themeId) {
      return
    }
    const theme = await fetchTheme(parseInt(this.themeId, 10), this.adminSession)
    if (!theme) {
      this.removeTheme()
    }
    return theme
  }

  private async create() {
    const name = generateThemeName(this.context)
    const role = DEVELOPMENT_THEME_ROLE
    const theme = await createTheme(
      {
        name,
        role,
      },
      this.adminSession,
    )
    if (!theme) {
      throw new BugError(`Could not create theme with name "${name}" and role "${role}"`)
    }
    this.setTheme(theme.id.toString())
    return theme
  }
}
