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
export class PreviewSessionError extends AbortError {}

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
    // When the store is not password protected, storefront_digest is not required.
    cookieRecord._shopify_essential = await sessionEssentialCookie(storeUrl, themeId, headers)
    return cookieRecord
  }

  const storeOrigin = prependHttps(storeFqdn)

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

  outputDebug(
    `Storefront preview session: status=${response.status}, request_id=${
      response.headers.get('x-request-id') ?? 'unknown'
    }, attempt=${retries}, forwarded_essential=${Boolean(
      incomingEssential,
    )}, returned_essential=${Boolean(shopifyEssential)}, essential_rotated=${Boolean(
      incomingEssential && shopifyEssential && incomingEssential !== shopifyEssential,
    )}`,
  )

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

    const isRedirect = response.status >= 300 && response.status < 400

    if (incomingEssential && isRedirect) {
      throw recordError(
        new PreviewSessionError(
          'Your development session could not be created because the theme preview could not be attached to the storefront session.',
          'Verify the theme exists by running shopify theme list, then try again. If the problem persists, re-run with --verbose and share the request ID with Shopify Support.',
        ),
      )
    }

    if (retries > 3) {
      throw recordError(
        incomingEssential
          ? new PreviewSessionError(
              'Your development session could not be created because the theme preview could not be attached to the storefront session.',
              'Verify the theme exists by running shopify theme list, then try again. If the problem persists, re-run with --verbose and share the request ID with Shopify Support.',
            )
          : new ShopifyEssentialError(
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

  outputDebug(
    `Storefront password session: status=${response.status}, request_id=${
      response.headers.get('x-request-id') ?? 'unknown'
    }, returned_essential=${Boolean(newShopifyEssential)}, returned_digest=${Boolean(storefrontDigest)}`,
  )

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
