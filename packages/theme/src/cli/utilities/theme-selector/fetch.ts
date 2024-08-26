import {GetThemes, GetThemesQueryVariables} from '@shopify/app'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'
import {adminRequestDoc} from '@shopify/cli-kit/node/api/admin'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import type {Theme} from '@shopify/cli-kit/node/themes/types'

export type Role = 'live' | 'development' | 'unpublished'
export const ALLOWED_ROLES: Role[] = ['live', 'unpublished', 'development']

export async function fetchStoreThemes(session: AdminSession): [Theme] {
  const store = session.storeFqdn

  const themes: any[] = []
  let cursor = null

  while (true) {
    const vars: GetThemesQueryVariables = {after: cursor}
    const response = await adminRequestDoc(GetThemes, session, vars)
    response.themes?.nodes.forEach((theme) => {
      // theme.role = theme.role.toLowerCase()
      // Strip off gid://shopify/Theme/ from the id
      // We should probably leave this as a gid for subsequent requests
      // theme.id = parseInt((theme.id as unknown as string).split('/').pop() as string, 10)

      const t = buildTheme({id: parseInt(theme.id as unknown as string, 10), name: theme.name, role: theme.role})
      if (t !== undefined) {
        themes.push(t)
      }
    })
    if (response.themes?.pageInfo.hasNextPage) {
      cursor = `"${response.themes.pageInfo.endCursor}"`
    } else {
      break
    }
  }

  if (themes.length === 0) {
    throw new AbortError(`There are no themes in the ${store} store`)
  }

  return themes.sort(byRole)
}

function isRoleAllowed(theme: Theme) {
  return (ALLOWED_ROLES as string[]).includes(theme.role)
}

function byRole(themeA: Theme, themeB: Theme) {
  return (ALLOWED_ROLES as string[]).indexOf(themeA.role) - (ALLOWED_ROLES as string[]).indexOf(themeB.role)
}
