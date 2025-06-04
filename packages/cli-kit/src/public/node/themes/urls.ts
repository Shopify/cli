import {Theme} from './types.js'
import {AdminSession} from '../session.js'

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

export function storePasswordPage(store: AdminSession['storeFqdn']) {
  return `https://${store}/admin/online_store/preferences`
}
