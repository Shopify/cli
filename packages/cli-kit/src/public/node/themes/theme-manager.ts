import {fetchTheme, themeCreate} from './api.js'
import {Theme} from './types.js'
import {DEVELOPMENT_THEME_ROLE, Role} from './utils.js'
import {generateThemeName} from '../../../private/node/themes/generate-theme-name.js'
import {AdminSession} from '../session.js'
import {BugError} from '../error.js'

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

  generateThemeName(context: string) {
    return generateThemeName(context)
  }

  async create(themeRole?: Role, themeName?: string) {
    const name = themeName ?? generateThemeName(this.context)
    const role = themeRole ?? DEVELOPMENT_THEME_ROLE
    const theme = await themeCreate(
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
