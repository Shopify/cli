import {findOrSelectTheme} from '../utilities/theme-selector.js'
import {themeEditorUrl, themePreviewUrl} from '../utilities/theme-urls.js'
import {themeComponent} from '../utilities/theme-ui.js'
import {openURL} from '@shopify/cli-kit/node/system'
import {renderInfo} from '@shopify/cli-kit/node/ui'
import {AdminSession} from '@shopify/cli-kit/node/session'

export async function open(
  adminSession: AdminSession,
  options: {development: boolean; live: boolean; editor: boolean; theme: string | undefined},
) {
  const theme = await findOrSelectTheme(adminSession, {
    header: 'Select a theme to open',
    filter: {
      development: options.development,
      live: options.live,
      theme: options.theme,
    },
  })

  const previewUrl = themePreviewUrl(theme, adminSession)
  const editorUrl = themeEditorUrl(theme, adminSession)

  renderInfo({
    headline: [`Preview information for theme`, ...themeComponent(theme)],
    body: {
      list: {
        items: [
          {link: {label: 'Preview your theme', url: previewUrl}},
          {link: {label: 'Customize your theme at the theme editor', url: editorUrl}},
        ],
      },
    },
  })

  if (options.editor) {
    await openURL(editorUrl)
  } else {
    await openURL(previewUrl)
  }
}
