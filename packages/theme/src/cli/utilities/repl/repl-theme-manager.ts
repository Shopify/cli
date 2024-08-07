import {getREPLTheme, setREPLTheme, removeREPLTheme} from '../../services/local-storage.js'
import {ThemeManager} from '@shopify/cli-kit/node/themes/theme-manager'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {DEVELOPMENT_THEME_ROLE, Role} from '@shopify/cli-kit/node/themes/utils'
import {bulkUploadThemeAssets} from '@shopify/cli-kit/node/themes/api'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'

export class REPLThemeManager extends ThemeManager {
  protected context = 'REPL'

  constructor(adminSession: AdminSession) {
    super(adminSession)
    this.themeId = getREPLTheme()
  }

  async create(themeRole: Role, themeName: string) {
    const theme = await super.create(themeRole, themeName)
    await this.uploadThemeAssets(theme)

    return theme
  }

  async findOrCreate(): Promise<Theme> {
    let theme = await this.fetch()
    if (!theme) {
      const themeName = `Liquid Console (${CLI_KIT_VERSION})`
      theme = await this.create(DEVELOPMENT_THEME_ROLE, themeName)
    }
    return theme
  }

  protected setTheme(themeName: string): void {
    setREPLTheme(themeName)
  }

  protected removeTheme(): void {
    removeREPLTheme()
  }

  private async uploadThemeAssets(theme: Theme) {
    const assets = [
      {key: 'config/settings_data.json', value: '{}'},
      {key: 'config/settings_schema.json', value: '[]'},
      {key: 'snippets/eval.liquid', value: ''},
      {key: 'layout/password.liquid', value: '{{ content_for_header }}{{ content_for_layout }}'},
      {key: 'layout/theme.liquid', value: '{{ content_for_header }}{{ content_for_layout }}'},
      {key: 'sections/announcement-bar.liquid', value: ''},
      {
        key: 'templates/index.json',
        value: JSON.stringify({
          sections: {
            announcement: {type: 'announcement-bar', settings: {}},
          },
          order: ['announcement'],
        }),
      },
    ]
    await bulkUploadThemeAssets(theme.id, assets, this.adminSession)
  }
}
