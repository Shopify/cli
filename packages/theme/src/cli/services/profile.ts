import {themeProfileResultSchema} from './profile/types.js'
import {render, STOREFRONT_RENDERER_QUERY_PARAMS} from '../utilities/theme-environment/storefront-renderer.js'
import {fetchDevServerSession} from '../utilities/theme-environment/dev-server-session.js'
import {ensureValidPassword} from '../utilities/theme-environment/storefront-password-prompt.js'
import {isStorefrontPasswordProtected} from '../utilities/theme-environment/storefront-session.js'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'

/** Origin used to parse store-relative URLs. It's never requested. */
const PLACEHOLDER_ORIGIN = 'https://storefront.invalid'

/** Longest non-JSON response body included in an error message, so full HTML pages are never shown. */
const MAX_ERROR_BODY_LENGTH = 200

export async function profile(
  adminSession: AdminSession,
  themeId: string,
  url: string,
  themeAccessPassword?: string,
  storefrontPassword?: string,
) {
  // A leading `//` would be parsed as a host, so the rest of the path would be profiled instead.
  if (url.startsWith('//') || !URL.canParse(url, PLACEHOLDER_ORIGIN)) {
    throw new AbortError(
      `${url} isn't a valid storefront URL.`,
      'Pass the path of a storefront page to --url, for example /products/classic-leather-jacket.',
    )
  }

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
  const target = storefrontTarget(url)
  const response = await render(session, {
    method: 'GET',
    path: target.pathname,
    query: [...target.searchParams],
    themeId,
    headers: {
      Accept: 'application/vnd.speedscope+json',
    },
  })

  if (response.status >= 300 && response.status < 400) {
    throw new AbortError(
      `The page ${url} redirects (${response.status}) instead of rendering, so it can't be profiled.`,
      redirectTryMessage(target, response.headers.get('Location')),
    )
  }

  if (response.status !== 200) {
    const details = await responseErrorDetails(response)
    throw new AbortError(`Can't profile ${url}. The storefront responded with ${response.status}.${details}`)
  }

  const profileJson = await response.text()

  return {result: themeProfileResultSchema.parse(JSON.parse(profileJson)), source: profileJson}
}

/**
 * Parses a `--url` or `Location` value into a URL without the renderer's own query params.
 * The renderer adds its own query, so the query has to be passed separately from the path.
 */
function storefrontTarget(url: string) {
  const target = new URL(url, PLACEHOLDER_ORIGIN)
  Object.keys(STOREFRONT_RENDERER_QUERY_PARAMS).forEach((param) => target.searchParams.delete(param))
  return target
}

function pathWithQuery(target: URL) {
  return `${target.pathname}${target.search}`
}

function redirectTryMessage(requestedTarget: URL, location: string | null) {
  if (!location || !URL.canParse(location, PLACEHOLDER_ORIGIN)) return null

  const redirectTarget = storefrontTarget(location)
  if (redirectTarget.pathname === '/password') {
    return 'It redirects to the storefront password page. Check the storefront password, and pass it with --store-password.'
  }

  const suggestedUrl = pathWithQuery(redirectTarget)
  const isStoreRelative = redirectTarget.origin === PLACEHOLDER_ORIGIN
  const destination = isStoreRelative ? suggestedUrl : redirectTarget.href

  // Suggesting the same --url again would make scripts and agents retry the same redirect.
  if (suggestedUrl === pathWithQuery(requestedTarget)) return `It redirects to ${destination}.`

  // An absolute destination can be another host, such as customer accounts, where the path doesn't exist on the store.
  return isStoreRelative
    ? `It redirects to ${destination}. Run the command again with --url "${suggestedUrl}".`
    : `It redirects to ${destination}. If that page is on your storefront, run the command again with --url "${suggestedUrl}".`
}

async function responseErrorDetails(response: Response) {
  const requestId = response.headers.get('x-request-id')
  const requestIdDetail = requestId ? `\nRequest ID: ${requestId}` : ''

  const body = (await response.text()).trim()
  const isJsonBody = response.headers.get('Content-Type')?.includes('application/json') ?? false
  const showBody = body.length > 0 && (isJsonBody || body.length <= MAX_ERROR_BODY_LENGTH)
  const bodyDetail = showBody ? `\n${body}` : ''

  return `${requestIdDetail}${bodyDetail}`
}
