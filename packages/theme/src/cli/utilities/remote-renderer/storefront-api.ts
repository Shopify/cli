import FormData, {fetch} from '@shopify/cli-kit/node/http'
import {parseCookies, serializeCookies} from './cookies.js'

export async function isStorefrontPasswordProtected(storeURL: string): Promise<boolean> {
  const response = await fetch(storeURL, {
    method: 'GET',
    redirect: 'manual',
  })

  return response.status === 302
}

export async function getStorefrontSession(
  storeUrl: string,
  themeId: string,
  password?: string,
): Promise<Record<string, string>> {
  const shopifyEssential = await sessionEssentialCookie(storeUrl, themeId)

  const cookieRecord: Record<string, string> = {_shopify_essential: shopifyEssential}

  if (password) {
    const storefrontDigest = await enrichSessionWithStorefrontPassword(shopifyEssential, storeUrl, password)

    if (storefrontDigest) {
      cookieRecord['storefront_digest'] = storefrontDigest
    }
  }

  return cookieRecord
}

async function sessionEssentialCookie(store: string, themeId: string): Promise<string> {
  const searchParams = new URLSearchParams({
    preview_theme_id: themeId,
    _fd: '0',
    pb: '0',
  })

  const url = `${store}?${searchParams}`

  const response = await fetch(url, {
    method: 'HEAD',
    redirect: 'manual',
  })

  const setCookies = response.headers.raw()['set-cookie'] ?? []

  const shopifyEssentialCookie = setCookies.find((cookie) => cookie.startsWith('_shopify_essential=')) ?? ''
  const cookies = parseCookies(shopifyEssentialCookie)

  const shopifyEssential = cookies['_shopify_essential'] ?? ''

  return shopifyEssential
}

async function enrichSessionWithStorefrontPassword(shopifyEssential: string, storeUrl: string, password: string) {
  const searchParams = new URLSearchParams({
    password,
  })

  const url = `${storeUrl}/password?${searchParams}`

  const response = await fetch(url, {
    method: 'GET',
    redirect: 'manual',
    headers: {
      Cookie: serializeCookies({_shopify_essential: shopifyEssential}),
    },
  })

  const setCookies = response.headers.raw()['set-cookie'] ?? []

  console.log(setCookies)

  const storefrontDigestCookie = setCookies.find((cookie) => cookie.startsWith('storefront_digest=')) ?? ''
  const cookies = parseCookies(storefrontDigestCookie)

  const storefrontDigest = cookies['storefront_digest'] ?? ''

  return storefrontDigest
}
