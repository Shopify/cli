import {getREPLTheme, setREPLTheme, removeREPLTheme} from '../services/local-storage.js'
import {ThemeManager} from '@shopify/cli-kit/node/themes/theme-manager'
import {AdminSession} from '@shopify/cli-kit/node/session'

export class REPLThemeManager extends ThemeManager {
  protected context = 'REPL'

  constructor(adminSession: AdminSession) {
    super(adminSession)
    this.themeId = getREPLTheme()
  }

  protected setTheme(themeName: string): void {
    setREPLTheme(themeName)
  }

  protected removeTheme(): void {
    removeREPLTheme()
  }
}
