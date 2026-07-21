import {defaultHeaders} from './storefront-utils.js'
import {parseCookies, serializeCookies} from './cookies.js'
import {type CrawlerSignatureHeaders} from './crawler-signature.js'
import {shopifyFetch, Response} from '@shopify/cli-kit/node/http'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {type AdminSession} from '@shopify/cli-kit/node/session'
import {passwordProtected} from '@shopify/cli-kit/node/themes/api'
import {sleep} from '@shopify/cli-kit/node/system'
import {recordError, recordEvent} from '@shopify/cli-kit/node/analytics'

export class ShopifyEssentialError extends AbortError {}

export async function isStorefrontPasswordProtected(session: AdminSession): Promise<boolean> {
  return passwordProtected(session)
}

/**
 * Sends a request to the password redirect page.
 * If the password is correct, SFR will respond with a 302 to redirect to the storefront
 */
export async function isStorefrontPasswordCorrect(
  password: string | undefined,
  store: string,
  crawlerSignatureHeaders?: CrawlerSignatureHeaders,
) {
  const storeUrl = prependHttps(store)
  const params = new URLSearchParams()

  params.append('form_type', 'storefront_password')
  params.append('utf8', '✓')
  params.append('password', password ?? '')

  recordEvent('theme-service:storefront-session:check-storefront-password')

  const requestHeaders = {
    'cache-control': 'no-cache',
    'content-type': 'application/x-www-form-urlencoded',
    ...crawlerSignatureHeaders,
  }

  const response = await shopifyFetch(`${storeUrl}/password`, {
    headers: requestHeaders,
    body: params.toString(),
    method: 'POST',
    redirect: 'manual',
  })

  if (response.status === 429) {
    throw recordError(
      new AbortError(
        `Too many incorrect password attempts. Please try again after ${response.headers.get('retry-after')} seconds.`,
      ),
    )
  }

  return redirectsToStorefront(response, storeUrl)
}

export async function getStorefrontSessionCookies(
  storeUrl: string,
  storeFqdn: string,
  themeId: string,
  password?: string,
  headers: Record<string, string> = {},
): Promise<Record<string, string>> {
  const cookieRecord: Record<string, string> = {}

  recordEvent(`theme-service:storefront-session:is-password-protected:${Boolean(password)}`)

  if (!password) {
    /**
     * When the store is not password protected, storefront_digest is not
     * required, so a single preview HEAD mints the session cookie.
     */
    cookieRecord._shopify_essential = await sessionEssentialCookie(storeUrl, themeId, headers)
    return cookieRecord
  }

  const storeOrigin = prependHttps(storeFqdn)

  /**
   * For password-protected stores the session is primed in two ordered steps:
   *   1. POST /password first (cold) to obtain the digest-bearing session.
   *   2. HEAD /?preview_theme_id last, forwarding that digest session so SFR
   *      stamps preview_theme_id into the same _shopify_essential.
   * Running the preview HEAD last ensures the final cookie carries BOTH the
   * password digest and the preview theme id.
   */
  const passwordCookies = await enrichSessionWithStorefrontPassword(storeUrl, storeOrigin, password, headers)

  cookieRecord._shopify_essential = await sessionEssentialCookie(
    storeUrl,
    themeId,
    headers,
    passwordCookies._shopify_essential,
  )

  if (passwordCookies.storefront_digest) {
    cookieRecord.storefront_digest = passwordCookies.storefront_digest
  }

  return cookieRecord
}

async function sessionEssentialCookie(
  storeUrl: string,
  themeId: string,
  headers: Record<string, string>,
  incomingEssential?: string,
  retries = 1,
) {
  const params = new URLSearchParams({
    preview_theme_id: themeId,
    _fd: '0',
    pb: '0',
  })

  const url = `${storeUrl}?${params}`

  recordEvent(`theme-service:storefront-session:get-session-essential-cookie`)

  const requestHeaders: Record<string, string> = {
    ...headers,
    ...defaultHeaders(),
  }

  /**
   * When priming a password-protected session, forward the digest-bearing
   * essential so SFR stamps preview_theme_id into that same cookie instead of
   * minting a preview-only one.
   */
  if (incomingEssential) {
    requestHeaders.Cookie = serializeCookies({_shopify_essential: incomingEssential})
  }

  const response = await shopifyFetch(url, {
    method: 'HEAD',
    redirect: 'manual',
    headers: requestHeaders,
  })

  const setCookies = response.headers.raw()['set-cookie'] ?? []
  const shopifyEssential = getCookie(setCookies, '_shopify_essential')

  /**
   * SFR should always define a _shopify_essential, so an error at this point
   * is likely a Shopify error or firewall issue.
   */
  if (!shopifyEssential) {
    outputDebug(
      `Failed to obtain _shopify_essential cookie.\n
       -Request ID: ${response.headers.get('x-request-id') ?? 'unknown'}\n
       -Body: ${await response.text()}\n
       -Status: ${response.status}\n`,
    )

    if (retries > 3) {
      throw recordError(
        new ShopifyEssentialError(
          'Your development session could not be created because the "_shopify_essential" could not be defined. Please, check your internet connection.',
        ),
      )
    }

    outputDebug('Retrying to obtain the _shopify_essential cookie...')
    await sleep(retries)

    return sessionEssentialCookie(storeUrl, themeId, headers, incomingEssential, retries + 1)
  }

  return shopifyEssential
}

async function enrichSessionWithStorefrontPassword(
  storeUrl: string,
  storeOrigin: string,
  password: string,
  headers: Record<string, string>,
): Promise<Record<string, string>> {
  const params = new URLSearchParams({password})

  /**
   * This runs first (cold) for password-protected stores, so it does not carry
   * a pre-existing _shopify_essential — SFR mints a digest-bearing session on
   * the response.
   */
  const requestHeaders = {
    ...headers,
    ...defaultHeaders(),
  }

  const response = await shopifyFetch(`${storeUrl}/password`, {
    method: 'POST',
    redirect: 'manual',
    body: params,
    headers: requestHeaders,
  })

  if (!redirectsToStorefront(response, storeOrigin)) {
    throw recordError(
      new AbortError(
        'Your development session could not be created because the store password is invalid. Please, retry with a different password.',
      ),
    )
  }

  const setCookies = response.headers.raw()['set-cookie'] ?? []
  const storefrontDigest = getCookie(setCookies, 'storefront_digest')
  const newShopifyEssential = getCookie(setCookies, '_shopify_essential')

  const result: Record<string, string> = {}

  if (storefrontDigest) {
    result.storefront_digest = storefrontDigest
  }

  if (newShopifyEssential) {
    result._shopify_essential = newShopifyEssential
  }

  return result
}

function redirectsToStorefront(response: Response, storeUrl: string) {
  const locationHeader = response.headers.get('location') ?? ''
  let redirectUrl: URL

  try {
    redirectUrl = new URL(locationHeader, storeUrl)
  } catch (error) {
    if (error instanceof TypeError) {
      return false
    }
    throw error
  }

  const storeOrigin = new URL(storeUrl).origin

  return response.status === 302 && redirectUrl.origin === storeOrigin
}

function getCookie(setCookieArray: string[], cookieName: string) {
  const cookie = setCookieArray.find((cookie) => {
    return parseCookies(cookie)[cookieName]
  })

  if (!cookie) return

  const parsedCookie = parseCookies(cookie)

  return parsedCookie[cookieName]
}

function prependHttps(url: string): string {
  return `https://${url}`
}
