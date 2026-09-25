import {ThemePublishResult} from './publish/types.js'
import {findOrSelectTheme} from '../utilities/theme-selector.js'
import {themePublish} from '@shopify/cli-kit/node/themes/api'
import {themePreviewUrl} from '@shopify/cli-kit/node/themes/urls'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'
import {AdminSession} from '@shopify/cli-kit/node/session'

interface PublishServiceOptions {
  theme: string | undefined
  force: boolean
}

export async function publish(
  adminSession: AdminSession,
  options: PublishServiceOptions,
  multiEnvironment?: boolean,
): Promise<ThemePublishResult | undefined> {
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

  // The API helper rejects missing themes and user errors before returning.
  const publishedTheme = (await themePublish(themeToPublish.id, adminSession))!
  return {
    data: {theme: {...publishedTheme, shop: adminSession.storeFqdn}},
    originalTheme: themeToPublish,
    previewUrl,
  }
}
