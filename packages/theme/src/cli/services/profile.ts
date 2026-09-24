import {themeProfileJsonOutputSchema} from './profile/types.js'
import {render} from '../utilities/theme-environment/storefront-renderer.js'
import {fetchDevServerSession} from '../utilities/theme-environment/dev-server-session.js'
import {ensureValidPassword} from '../utilities/theme-environment/storefront-password-prompt.js'
import {isStorefrontPasswordProtected} from '../utilities/theme-environment/storefront-session.js'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'

export async function profile(
  adminSession: AdminSession,
  themeId: string,
  url: string,
  themeAccessPassword?: string,
  storefrontPassword?: string,
) {
  const storePassword = (await isStorefrontPasswordProtected(adminSession))
    ? await ensureValidPassword(storefrontPassword, adminSession.storeFqdn)
    : undefined

  if (themeAccessPassword) {
    throw new AbortError(
      'Unable to use Admin API or Theme Access tokens with the profile command',
      'You must authenticate manually by not passing the --password flag.',
    )
  }

  const session = await fetchDevServerSession(themeId, adminSession, themeAccessPassword, storePassword)
  const response = await render(session, {
    method: 'GET',
    path: url,
    query: [],
    themeId,
    headers: {
      Accept: 'application/vnd.speedscope+json',
    },
  })

  if (response.status !== 200) {
    const body = await response.text()
    throw new Error(`Bad response: ${response.status}: ${body}`)
  }

  const profileJson = await response.text()

  return {result: themeProfileJsonOutputSchema.validate(JSON.parse(profileJson)), source: profileJson}
}
