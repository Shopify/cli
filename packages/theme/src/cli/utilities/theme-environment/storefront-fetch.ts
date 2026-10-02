import {EnvHttpProxyAgent} from 'undici'

export const MAX_HEADER_SIZE = 128 * 1024

export const storefrontDispatcher = new EnvHttpProxyAgent({
  httpProxy: process.env.SHOPIFY_HTTP_PROXY,
  httpsProxy: process.env.SHOPIFY_HTTPS_PROXY,
  noProxy: process.env.SHOPIFY_NO_PROXY,
  maxHeaderSize: MAX_HEADER_SIZE,
})

export function storefrontFetch(url: string | URL, options: RequestInit): Promise<Response> {
  // The explicit dispatcher keeps Node's fetch compatible with Shopify's proxy settings.
  // eslint-disable-next-line no-restricted-globals
  return fetch(url, {
    ...options,
    dispatcher: storefrontDispatcher,
  } as RequestInit & {dispatcher: EnvHttpProxyAgent})
}
