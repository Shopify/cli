import {Theme} from '../models/theme.js'
import {session} from '@shopify/cli-kit'

type AdminSession = session.AdminSession

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

export function storeAdminUrl(session: AdminSession) {
  const store = session.storeFqdn
  return `https://${store}/admin`
}
