import {findOrSelectTheme} from '../utilities/theme-selector.js'
import {themeComponent} from '../utilities/theme-ui.js'
import {publishTheme} from '@shopify/cli-kit/node/themes/api'
import {themePreviewUrl} from '@shopify/cli-kit/node/themes/urls'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {renderConfirmationPrompt, renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {AdminSession} from '@shopify/cli-kit/node/session'

export function renderArgumentsWarning(id: string) {
  renderWarning({
    body: [
      'The theme ID positional argument is deprecated. Use the',
      {command: '--theme'},
      'flag instead:\n\n',
      {command: `$ shopify theme publish --theme ${id}`},
      {char: '.'},
    ],
  })
}

export async function publish(adminSession: AdminSession, themeId: string | undefined, options: {force: boolean}) {
  const theme = await findOrSelectTheme(adminSession, {
    header: 'Select a theme to publish',
    filter: {
      development: false,
      live: false,
      theme: themeId,
    },
  })

  const previewUrl = themePreviewUrl({...theme, role: 'live'} as Theme, adminSession)

  if (!options.force) {
    const accept = await renderConfirmationPrompt({
      message: `Do you want to make '${theme.name}' the new live theme on ${adminSession.storeFqdn}?`,
      confirmationMessage: `Yes, make '${theme.name}' the new live theme`,
      cancellationMessage: 'No, cancel publish',
    })
    if (!accept) return
  }

  await publishTheme(theme.id, adminSession)

  renderSuccess({
    body: [
      'The theme',
      ...themeComponent(theme),
      'is now live at',
      {
        link: {
          label: previewUrl,
          url: previewUrl,
        },
      },
      {char: '.'},
    ],
  })
}
