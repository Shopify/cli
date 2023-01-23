import {fetchTheme, createTheme} from './themes-api.js'
import {generateDevelopmentThemeName} from './generate-development-theme-name.js'
import {DEVELOPMENT_THEME_ROLE} from '../models/theme.js'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {AbortError, BugError} from '@shopify/cli-kit/node/error'
import {store as defaultStorage} from '@shopify/cli-kit'

export const DEVELOPMENT_THEME_NOT_FOUND = (themeId: string) =>
  `Development theme #${themeId} could not be found. Please create a new development theme.`
export const NO_DEVELOPMENT_THEME_ID_SET =
  'No development theme ID has been set. Please create a development theme first.'

interface Storage {
  getDevelopmentTheme: () => string | undefined
  setDevelopmentTheme: (theme: string) => void
  removeDevelopmentTheme: () => void
}

interface ThemesAPI {
  fetchTheme: typeof fetchTheme
  createTheme: typeof createTheme
}

export class DevelopmentThemeManager {
  private themeId: string | undefined

  constructor(
    private adminSession: AdminSession,
    private storage: Storage = defaultStorage,
    private api: ThemesAPI = {
      fetchTheme,
      createTheme,
    },
    private generateName = generateDevelopmentThemeName,
  ) {
    this.themeId = storage.getDevelopmentTheme()
  }

  async find() {
    const theme = await this.fetch()
    if (!theme) {
      throw new AbortError(this.themeId ? DEVELOPMENT_THEME_NOT_FOUND(this.themeId) : NO_DEVELOPMENT_THEME_ID_SET)
    }
    return theme
  }

  async findOrCreate() {
    let theme = await this.fetch()
    if (!theme) {
      theme = await this.create()
    }
    return theme.id.toString()
  }

  private async fetch() {
    if (!this.themeId) {
      return
    }
    const theme = await this.api.fetchTheme(parseInt(this.themeId, 10), this.adminSession)
    if (!theme) {
      this.storage.removeDevelopmentTheme()
    }
    return theme
  }

  private async create() {
    const name = this.generateName()
    const role = DEVELOPMENT_THEME_ROLE
    const theme = await this.api.createTheme(
      {
        name,
        role,
      },
      this.adminSession,
    )
    if (!theme) {
      throw new BugError(`Could not create theme with name "${name}" and role "${role}"`)
    }
    this.storage.setDevelopmentTheme(theme.id.toString())
    return theme
  }
}
