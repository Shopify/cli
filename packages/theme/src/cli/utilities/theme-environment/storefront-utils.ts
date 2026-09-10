import {DevServerRenderContext} from './types.js'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'
import {type Response as HttpResponse} from '@shopify/cli-kit/node/http'

/**
 * The "null body statuses" of the Fetch spec, which the `Response` constructor refuses to pair with
 * a body.
 *
 * The built-in fetch reports a `null` body for these, but the client in
 * `@shopify/cli-kit/node/http` always reports a stream, so the body has to be dropped explicitly.
 * `304` is the one that matters in practice: the browser revalidates every cached asset.
 */
const NULL_BODY_STATUSES = new Set([101, 103, 204, 205, 304])

/**
 * Storefront requests are proxied straight through to the browser, so they keep the behaviour the
 * built-in fetch had here: no automatic cancellation (a slow theme should still render) and no
 * automatic retries (these carry cart and checkout writes, which are not safe to replay).
 */
export const STOREFRONT_REQUEST_BEHAVIOUR = 'slow-request' as const

/**
 * Converts a response from `@shopify/cli-kit/node/http` into a built-in `Response`.
 *
 * The dev server hands its responses to H3, which only understands the built-in type, so this is
 * the boundary where responses from the proxy-aware client are converted back.
 */
export function toWebResponse(response: HttpResponse): Response {
  const body = NULL_BODY_STATUSES.has(response.status) ? null : response.body

  // Iterating the client's headers joins repeated values with ', ', which would merge the
  // storefront's `set-cookie` headers into one. `raw()` keeps each value separate.
  const headers = Object.entries(response.headers.raw()).flatMap(([name, values]) =>
    values.map((value): [string, string] => [name, value]),
  )

  return new Response(body as BodyInit | null, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export function storefrontReplaceTemplatesParams(context: DevServerRenderContext): URLSearchParams {
  /**
   * Theme access proxy doesn't support FormData encoding.
   */
  const params = new URLSearchParams()

  for (const [path, content] of Object.entries(context.replaceTemplates ?? [])) {
    params.append(`replace_templates[${path}]`, content)
  }

  for (const [path, content] of Object.entries(context.replaceExtensionTemplates ?? [])) {
    const bucket = path.split('/')[0]
    params.append(`replace_extension_templates[${bucket}][${path}]`, content)
  }

  params.append('_method', context.method)

  return params
}

export function defaultHeaders() {
  return {
    'User-Agent': `Shopify CLI; v=${CLI_KIT_VERSION}`,
  }
}

export function cleanHeader(headers: Record<string, string>): Record<string, string> {
  // Force the use of the 'Cookie' key if consumers also provide the 'cookie' key
  delete headers.cookie
  delete headers.authorization
  return headers
}
