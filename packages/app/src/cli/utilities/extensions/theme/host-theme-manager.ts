import {waitForThemeToBeProcessed} from './host-theme-watcher.js'
import {getHostTheme, removeHostTheme, setHostTheme} from '@shopify/cli-kit/node/themes/conf'
import {ThemeManager} from '@shopify/cli-kit/node/themes/theme-manager'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {themeCreate} from '@shopify/cli-kit/node/themes/api'
import {DEVELOPMENT_THEME_ROLE} from '@shopify/cli-kit/node/themes/utils'
import {BugError} from '@shopify/cli-kit/node/error'
import {outputDebug} from '@shopify/cli-kit/node/output'

export const DEFAULT_THEME_ZIP = 'https://codeload.github.com/Shopify/dawn/zip/refs/tags/v15.0.0'
export const FALLBACK_THEME_ZIP = 'https://cdn.shopify.com/theme-store/uhrdefhlndzaoyrgylhto59sx2i7.jpg'
const retryAttemps = 3

export class HostThemeManager extends ThemeManager {
  protected context = 'App Ext. Host'
  protected devPreview: boolean

  constructor(adminSession: AdminSession, config = {devPreview: false}) {
    super(adminSession)
    this.themeId = getHostTheme(adminSession.storeFqdn)
    this.devPreview = config.devPreview
  }

  async findOrCreate(): Promise<Theme> {
    let theme = await this.fetch()
    if (!theme) {
      theme = this.devPreview ? await this.createHostTheme() : await this.create()
    }
    return theme
  }

  protected setTheme(themeId: string): void {
    setHostTheme(this.adminSession.storeFqdn, themeId)
  }

  protected removeTheme(): void {
    removeHostTheme(this.adminSession.storeFqdn)
  }

  private async createHostTheme(): Promise<Theme> {
    const options = {
      role: DEVELOPMENT_THEME_ROLE,
      name: this.generateThemeName(this.context),
      src: DEFAULT_THEME_ZIP,
    }

    for (let attempt = 0; attempt < retryAttemps; attempt++) {
      outputDebug(
        `Attempt ${attempt}/${retryAttemps}: Creating theme with name "${options.name}" and role "${options.role}"`,
      )

      try {
        // eslint-disable-next-line no-await-in-loop
        const theme = await themeCreate(options, this.adminSession)
        if (theme) {
          this.setTheme(theme.id.toString())
          outputDebug(`Waiting for theme with id "${theme.id}" to be processed`)
          // eslint-disable-next-line no-await-in-loop
          await waitForThemeToBeProcessed(theme.id, this.adminSession)
          return theme
        } else {
          throw new Error()
        }
        // eslint-disable-next-line no-catch-all/no-catch-all
      } catch (error) {
        outputDebug(`Failed to create theme with name "${options.name}" and role "${options.role}". Retrying...`)
      }
    }

    outputDebug(`Theme creation failed after ${retryAttemps} retries. Creating theme using fallback theme zip`)
    const theme = await themeCreate({...options, src: FALLBACK_THEME_ZIP}, this.adminSession)
    if (!theme) {
      outputDebug(`Theme creation failed. Exiting process.`)
      throw new BugError(`Could not create theme with name "${options.name}" and role "${options.role}"`)
    }
    return theme
  }
}
