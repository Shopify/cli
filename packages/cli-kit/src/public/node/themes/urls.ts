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
  return adminUrl(session.storeFqdn, `/themes/${theme.id}/editor`)
}

export function codeEditorUrl(theme: Theme, session: AdminSession) {
  return adminUrl(session.storeFqdn, `/themes/${theme.id}`)
}

export function storeAdminUrl(session: AdminSession) {
  return adminUrl(session.storeFqdn)
}

export function storePasswordPage(store: AdminSession['storeFqdn']) {
  return adminUrl(store, '/online_store/preferences')
}

function adminUrl(store: string, path = ''): string {
  return `https://${store}/admin${path}`
}
