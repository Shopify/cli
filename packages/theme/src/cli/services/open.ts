import {findOrSelectTheme} from '../utilities/theme-selector.js'
import {themeEditorUrl, themePreviewUrl} from '../utilities/theme-urls.js'
import {themeComponent} from '../utilities/theme-ui.js'
import {DevelopmentThemeManager} from '../utilities/development-theme-manager.js'
import {openURL} from '@shopify/cli-kit/node/system'
import {renderInfo} from '@shopify/cli-kit/node/ui'
import {AdminSession} from '@shopify/cli-kit/node/session'

export async function open(
  adminSession: AdminSession,
  options: {development: boolean; live: boolean; editor: boolean; theme: string | undefined},
) {
  let themeId = options.theme
  if (options.development) {
    const theme = await new DevelopmentThemeManager(adminSession).find()
    themeId = theme.id.toString()
  }

  const theme = await findOrSelectTheme(adminSession, {
    header: 'Select a theme to open',
    filter: {
      live: options.live,
      theme: themeId,
    },
  })

  const previewUrl = themePreviewUrl(theme, adminSession)
  const editorUrl = themeEditorUrl(theme, adminSession)

  renderInfo({
    body: [
      `Preview information for theme`,
      ...themeComponent(theme),
      '\n\n',
      {
        list: {
          items: [
            {link: {label: 'Preview your theme', url: previewUrl}},
            {link: {label: 'Customize your theme at the theme editor', url: editorUrl}},
          ],
        },
      },
    ],
  })

  if (options.editor) {
    await openURL(editorUrl)
  } else {
    await openURL(previewUrl)
  }
}
