import {parseCookies, serializeCookies} from './cookies.js'
import {defaultHeaders} from './storefront-utils.js'
import {fetch} from '@shopify/cli-kit/node/http'
import {AbortError} from '@shopify/cli-kit/node/error'

export async function isStorefrontPasswordProtected(storeURL: string): Promise<boolean> {
  const response = await fetch(prependHttps(storeURL), {
    method: 'GET',
    redirect: 'manual',
  })

  return response.status === 302
}

/**
 * Sends a request to the password redirect page.
 * If the password is correct, SFR will respond with a 302 to redirect to the storefront
 */
export async function isStorefrontPasswordCorrect(password: string | undefined, store: string) {
  const params = new URLSearchParams()

  params.append('form_type', 'storefront_password')
  params.append('utf8', '✓')
  params.append('password', password ?? '')

  const response = await fetch(`${prependHttps(store)}/password`, {
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
  return response.status === 302 && response.headers.get('location') === `${prependHttps(store)}/`
}

export async function getStorefrontSessionCookies(
  storeUrl: string,
  themeId: string,
  password?: string,
  headers: {[key: string]: string} = {},
): Promise<{[key: string]: string}> {
  const cookieRecord: {[key: string]: string} = {}
  const shopifyEssential = await sessionEssentialCookie(storeUrl, themeId, headers)

  if (!shopifyEssential) {
    /**
     * SFR should always define a _shopify_essential, so an error at this point
     * is likely a Shopify error or firewall issue.
     */
    throw new AbortError(
      'Your development session could not be created because the "_shopify_essential" could not be defined. Please, check your internet connection.',
    )
  }

  cookieRecord._shopify_essential = shopifyEssential

  if (!password) {
    /**
     * When the store is not password protected, storefront_digest is not
     * required.
     */
    return cookieRecord
  }

  const storefrontDigest = await enrichSessionWithStorefrontPassword(shopifyEssential, storeUrl, password, headers)

  if (!storefrontDigest) {
    throw new AbortError(
      'Your development session could not be created because the store password is invalid. Please, retry with a different password.',
    )
  }

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
