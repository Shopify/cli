import {type ThemeOpenResult} from './open/types.js'
import {DevelopmentThemeManager} from '../utilities/development-theme-manager.js'
import {findOrSelectTheme} from '../utilities/theme-selector.js'
import {themeEditorUrl, themePreviewUrl} from '@shopify/cli-kit/node/themes/urls'
import {AdminSession} from '@shopify/cli-kit/node/session'

export async function open(
  adminSession: AdminSession,
  options: {development: boolean; live: boolean; theme: string | undefined},
): Promise<ThemeOpenResult> {
  const developmentThemeManager = new DevelopmentThemeManager(adminSession)
  const developmentTheme = (
    await (options.development ? developmentThemeManager.find() : developmentThemeManager.fetch())
  )?.id
  const theme = await findOrSelectTheme(adminSession, {
    header: 'Select a theme to open',
    filter: {
      live: options.live,
      theme: options.development ? `${developmentTheme}` : options.theme,
    },
  })

  const previewUrl = themePreviewUrl(theme, adminSession)
  const editorUrl = themeEditorUrl(theme, adminSession)

  return {theme, preview_url: previewUrl, editor_url: editorUrl}
}
