import {findOrSelectTheme} from '../utilities/theme-selector.js'
import {themeEditorUrl, themePreviewUrl} from '../utilities/theme-urls.js'
import {session, system} from '@shopify/cli-kit'
import {renderInfo} from '@shopify/cli-kit/node/ui'

type AdminSession = session.AdminSession

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
    headline: {
      userInput: theme.name,
    },
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
    await system.open(editorUrl)
  } else {
    await system.open(previewUrl)
  }
}
