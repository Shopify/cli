import {findOrSelectTheme} from '../utilities/theme-selector.js'
import {themeComponent} from '../utilities/theme-ui.js'
import {themePublish} from '@shopify/cli-kit/node/themes/api'
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

interface PublishServiceOptions {
  theme: string | undefined
  force: boolean
}

export async function publish(adminSession: AdminSession, options: PublishServiceOptions) {
  const themeToPublish = await findOrSelectTheme(adminSession, {
    header: 'Select a theme to publish',
    filter: {
      development: false,
      live: false,
      theme: options.theme,
    },
  })

  const previewUrl = themePreviewUrl({...themeToPublish, role: 'live'} as Theme, adminSession)

  if (!options.force) {
    const accept = await renderConfirmationPrompt({
      message: `Do you want to make '${themeToPublish.name}' the new live theme on ${adminSession.storeFqdn}?`,
      confirmationMessage: `Yes, make '${themeToPublish.name}' the new live theme`,
      cancellationMessage: 'No, cancel publish',
    })
    if (!accept) return
  }

  await themePublish(themeToPublish.id, adminSession)

  renderSuccess({
    body: [
      'The theme',
      ...themeComponent(themeToPublish),
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
