import {Theme} from '../models/theme.js'
import {session} from '@shopify/cli-kit'

type AdminSession = session.AdminSession

export function previewLink(theme: Theme, session: AdminSession) {
  const store = session.storeFqdn
  if (theme.role === 'live') {
    return `https://${store}`
  }

  return `https://${store}?preview_theme_id=${theme.id}`
}

export function editorLink(theme: Theme, session: AdminSession) {
  const store = session.storeFqdn
  return `https://${store}/admin/themes/${theme.id}/editor`
}
