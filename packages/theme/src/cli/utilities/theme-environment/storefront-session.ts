import {parseCookies, serializeCookies} from './cookies.js'
import {defaultHeaders} from './storefront-utils.js'
import {fetch} from '@shopify/cli-kit/node/http'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputDebug} from '@shopify/cli-kit/node/output'

export class ShopifyEssentialError extends Error {}

export async function isStorefrontPasswordProtected(storeURL: string): Promise<boolean> {
  const response = await fetch(prependHttps(storeURL), {
    method: 'GET',
    redirect: 'manual',
  })

  if (response.status !== 302) return false

  return response.headers.get('location')?.endsWith('/password') ?? false
}

/**
 * Sends a request to the password redirect page.
 * If the password is correct, SFR will respond with a 302 to redirect to the storefront
 */
export async function isStorefrontPasswordCorrect(password: string | undefined, store: string) {
  const storeUrl = prependHttps(store)
  const params = new URLSearchParams()

  params.append('form_type', 'storefront_password')
  params.append('utf8', '✓')
  params.append('password', password ?? '')

  const response = await fetch(`${storeUrl}/password`, {
    headers: {
      'cache-control': 'no-cache',
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
    method: 'POST',
    redirect: 'manual',
  })

  if (response.status === 429) {
    throw new AbortError(
      `Too many incorrect password attempts. Please try again after ${response.headers.get('retry-after')} seconds.`,
    )
  }

  const isValidRedirect = new RegExp(`^${storeUrl}/?$`, 'i')

  return response.status === 302 && isValidRedirect.test(response.headers.get('location') ?? '')
}

export async function getStorefrontSessionCookies(
  storeUrl: string,
  themeId: string,
  password?: string,
  headers: {[key: string]: string} = {},
): Promise<{[key: string]: string}> {
  const cookieRecord: {[key: string]: string} = {}
  const shopifyEssential = await sessionEssentialCookie(storeUrl, themeId, headers)

  cookieRecord._shopify_essential = shopifyEssential

  if (!password) {
    /**
     * When the store is not password protected, storefront_digest is not
     * required.
     */
    return cookieRecord
  }

  const storefrontDigest = await enrichSessionWithStorefrontPassword(shopifyEssential, storeUrl, password, headers)

  cookieRecord.storefront_digest = storefrontDigest

  return cookieRecord
}

async function sessionEssentialCookie(storeUrl: string, themeId: string, headers: {[key: string]: string}) {
  const params = new URLSearchParams({
    preview_theme_id: themeId,
    _fd: '0',
    pb: '0',
  })

  const url = `${storeUrl}?${params}`

  const response = await fetch(url, {
    method: 'HEAD',
    redirect: 'manual',
    headers: {
      ...headers,
      ...defaultHeaders(),
    },
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
       -Body: ${await response.text()}`,
    )
    throw new ShopifyEssentialError(
      'Your development session could not be created because the "_shopify_essential" could not be defined. Please, check your internet connection.',
    )
  }

  return shopifyEssential
}

async function enrichSessionWithStorefrontPassword(
  shopifyEssential: string,
  storeUrl: string,
  password: string,
  headers: {[key: string]: string},
) {
  const params = new URLSearchParams({password})

  const response = await fetch(`${storeUrl}/password`, {
    method: 'POST',
    redirect: 'manual',
    body: params,
    headers: {
      ...headers,
      ...defaultHeaders(),
      Cookie: serializeCookies({_shopify_essential: shopifyEssential}),
    },
  })

  const setCookies = response.headers.raw()['set-cookie'] ?? []
  const storefrontDigest = getCookie(setCookies, 'storefront_digest')

  if (!storefrontDigest) {
    outputDebug(
      `Failed to obtain storefront_digest cookie.\n
       -Request ID: ${response.headers.get('x-request-id') ?? 'unknown'}\n
       -Body: ${await response.text()}`,
    )
    throw new AbortError(
      'Your development session could not be created because the store password is invalid. Please, retry with a different password.',
    )
  }

  return storefrontDigest
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
