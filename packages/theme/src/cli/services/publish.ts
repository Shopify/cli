import {findOrSelectTheme} from '../utilities/theme-selector.js'
import {themeComponent} from '../utilities/theme-ui.js'
import {themePublish} from '@shopify/cli-kit/themes/api'
import {themePreviewUrl} from '@shopify/cli-kit/themes/urls'
import {Theme} from '@shopify/cli-kit/themes/types'
import {renderConfirmationPrompt, renderSuccess} from '@shopify/cli-kit/shared/node/ui'
import {AdminSession} from '@shopify/cli-kit/identity/session'

interface PublishServiceOptions {
  theme: string | undefined
  force: boolean
  environment?: string
}

export async function publish(adminSession: AdminSession, options: PublishServiceOptions, multiEnvironment?: boolean) {
  const themeToPublish = await findOrSelectTheme(adminSession, {
    header: 'Select a theme to publish',
    filter: {
      development: false,
      live: false,
      theme: options.theme,
    },
  })

  const previewUrl = themePreviewUrl({...themeToPublish, role: 'live'} as Theme, adminSession)

  if (!options.force && !multiEnvironment) {
    const accept = await renderConfirmationPrompt({
      message: `Do you want to make '${themeToPublish.name}' the new live theme on ${adminSession.storeFqdn}?`,
      confirmationMessage: `Yes, make '${themeToPublish.name}' the new live theme`,
      cancellationMessage: 'No, cancel publish',
    })
    if (!accept) return
  }

  await themePublish(themeToPublish.id, adminSession)

  renderSuccess({
    headline: options.environment ? `Environment: ${options.environment}` : undefined,
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
