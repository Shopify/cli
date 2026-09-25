import {themeDuplicateResultSchema, ThemeDuplicateResult} from './duplicate/types.js'
import {findOrSelectTheme, findThemeById} from '../utilities/theme-selector.js'
import {themePreviewUrl} from '@shopify/cli-kit/node/themes/urls'
import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {themeDuplicate} from '@shopify/cli-kit/node/themes/api'
import {isCI} from '@shopify/cli-kit/node/system'

interface DuplicateOptions {
  name?: string
  force?: boolean
}

export async function duplicate(
  adminSession: AdminSession,
  themeId: string | undefined,
  flags: DuplicateOptions,
): Promise<ThemeDuplicateResult> {
  const {name, force} = flags
  const noPrompts = isCI() || force

  if (noPrompts && !themeId) {
    return {status: 'missing-theme-id'}
  }

  const themeToDuplicate = themeId
    ? await findThemeById(adminSession, themeId)
    : await findOrSelectTheme(adminSession, {
        header: 'Select a theme to duplicate',
        filter: {
          theme: themeId,
        },
      })

  if (!themeToDuplicate) {
    return {status: 'not-found', themeId: themeId!}
  }

  if (themeToDuplicate?.role === 'development') {
    return {status: 'development-theme'}
  }

  if (!noPrompts) {
    const accept = await renderConfirmationPrompt({
      message: `Do you want to duplicate '${themeToDuplicate.name}' on ${adminSession.storeFqdn}?`,
      confirmationMessage: `Yes, duplicate '${themeToDuplicate.name}'`,
      cancellationMessage: 'No, cancel duplicate',
    })
    if (!accept) return {status: 'cancelled'}
  }

  const result = await themeDuplicate(themeToDuplicate.id, name, adminSession)

  return themeDuplicateResultSchema.parse({
    status: 'completed',
    originalTheme: themeToDuplicate,
    shop: adminSession.storeFqdn,
    previewUrl: result.theme ? themePreviewUrl(result.theme, adminSession) : undefined,
    ...result,
  })
}
