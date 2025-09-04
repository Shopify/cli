import {parseCookies, serializeCookies} from './cookies.js'
import {defaultHeaders} from './storefront-utils.js'
import {shopifyFetch, Response} from '@shopify/cli-kit/node/http'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {type AdminSession} from '@shopify/cli-kit/node/session'
import {passwordProtected} from '@shopify/cli-kit/node/themes/api'
import {sleep} from '@shopify/cli-kit/node/system'

export class ShopifyEssentialError extends Error {}

export async function isStorefrontPasswordProtected(session: AdminSession): Promise<boolean> {
  return passwordProtected(session)
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

  const response = await shopifyFetch(`${storeUrl}/password`, {
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

  return redirectsToStorefront(response, storeUrl)
}

export async function getStorefrontSessionCookies(
  storeUrl: string,
  storeFqdn: string,
  themeId: string,
  password?: string,
  headers: {[key: string]: string} = {},
): Promise<{[key: string]: string}> {
  const cookieRecord: {[key: string]: string} = {}
  const shopifyEssential = await sessionEssentialCookie(storeUrl, themeId, headers)
  const storeOrigin = prependHttps(storeFqdn)

  cookieRecord._shopify_essential = shopifyEssential

  if (!password) {
    /**
     * When the store is not password protected, storefront_digest is not
     * required.
     */
    return cookieRecord
  }

  const additionalCookies = await enrichSessionWithStorefrontPassword(
    shopifyEssential,
    storeUrl,
    storeOrigin,
    password,
    headers,
  )

  return {...cookieRecord, ...additionalCookies}
}

async function sessionEssentialCookie(
  storeUrl: string,
  themeId: string,
  headers: {[key: string]: string},
  retries = 1,
) {
  const params = new URLSearchParams({
    preview_theme_id: themeId,
    _fd: '0',
    pb: '0',
  })

  const url = `${storeUrl}?${params}`

  const response = await shopifyFetch(url, {
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
       -Body: ${await response.text()}\n
       -Status: ${response.status}\n`,
    )

    if (retries > 3) {
      throw new ShopifyEssentialError(
        'Your development session could not be created because the "_shopify_essential" could not be defined. Please, check your internet connection.',
      )
    }

    outputDebug('Retrying to obtain the _shopify_essential cookie...')
    await sleep(retries)

    return sessionEssentialCookie(storeUrl, themeId, headers, retries + 1)
  }

  return shopifyEssential
}

async function enrichSessionWithStorefrontPassword(
  shopifyEssential: string,
  storeUrl: string,
  storeOrigin: string,
  password: string,
  headers: {[key: string]: string},
): Promise<{[key: string]: string}> {
  const params = new URLSearchParams({password})

  const response = await shopifyFetch(`${storeUrl}/password`, {
    method: 'POST',
    redirect: 'manual',
    body: params,
    headers: {
      ...headers,
      ...defaultHeaders(),
      Cookie: serializeCookies({_shopify_essential: shopifyEssential}),
    },
  })

  if (!redirectsToStorefront(response, storeOrigin)) {
    throw new AbortError(
      'Your development session could not be created because the store password is invalid. Please, retry with a different password.',
    )
  }

  const setCookies = response.headers.raw()['set-cookie'] ?? []
  const storefrontDigest = getCookie(setCookies, 'storefront_digest')
  const newShopifyEssential = getCookie(setCookies, '_shopify_essential')

  const result: {[key: string]: string} = {}

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
