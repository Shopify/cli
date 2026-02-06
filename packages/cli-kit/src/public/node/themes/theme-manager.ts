import {fetchTheme, findDevelopmentThemeByName, themeCreate} from './api.js'
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

  async findOrCreate(name?: string, role?: Role): Promise<Theme> {
    let theme = await this.fetch(name, role)
    if (!theme) {
      theme = await this.create(role, name)
    }
    return theme
  }

  async fetch(name?: string, role?: Role) {
    if (!this.themeId && !name) {
      return
    }

    const theme =
      name && role === DEVELOPMENT_THEME_ROLE
        ? await findDevelopmentThemeByName(name, this.adminSession)
        : // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          await fetchTheme(parseInt(this.themeId!, 10), this.adminSession)

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
