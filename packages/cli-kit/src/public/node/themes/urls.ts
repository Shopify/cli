import {Theme} from '@shopify/cli-kit/node/themes/types'
import {AdminSession} from '@shopify/cli-kit/node/session'

export function themePreviewUrl(theme: Theme, session: AdminSession) {
  const store = session.storeFqdn
  if (theme.role === 'live') {
    return `https://${store}`
  }

  return `https://${store}?preview_theme_id=${theme.id}`
}

export function themeEditorUrl(theme: Theme, session: AdminSession) {
  const store = session.storeFqdn
  return `https://${store}/admin/themes/${theme.id}/editor`
}

export function codeEditorUrl(theme: Theme, session: AdminSession) {
  const store = session.storeFqdn
  return `https://${store}/admin/themes/${theme.id}`
}

export function storeAdminUrl(session: AdminSession) {
  const store = session.storeFqdn
  return `https://${store}/admin`
}
