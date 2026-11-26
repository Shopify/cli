import {DevServerRenderContext} from './types.js'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'

/**
 * Regular expression source for the optional locale or market subfolder that
 * storefront paths can start with, such as `/fr`, `/en-us`, or `/zh-hans-cn`.
 * It follows the storefront's own subfolder format, which accepts the Chinese
 * script locales in addition to two- and three-letter language codes.
 */
export const LOCALE_PREFIX_PATTERN = String.raw`(?:/(?:zh-hans|zh-hant|[a-z]{2,3})(?:-[a-zA-Z0-9]{2,})?)?`

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
