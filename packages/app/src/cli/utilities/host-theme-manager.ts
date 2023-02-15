import {getHostTheme, removeHostTheme, setHostTheme} from '@shopify/cli-kit/node/themes/conf'
import {ThemeManager} from '@shopify/cli-kit/node/themes/theme-manager'
import {AdminSession} from '@shopify/cli-kit/node/session'

export class HostThemeManager extends ThemeManager {
  protected context = 'App Ext. Host'

  constructor(adminSession: AdminSession) {
    super(adminSession)
    this.themeId = getHostTheme(adminSession.storeFqdn)
  }

  protected setTheme(themeId: string): void {
    setHostTheme(this.adminSession.storeFqdn, themeId)
  }

  protected removeTheme(): void {
    removeHostTheme(this.adminSession.storeFqdn)
  }
}
