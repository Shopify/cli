import {DevServerRenderContext} from './types.js'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/shared/common/version'

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

export function cleanHeader(headers: {[key: string]: string}): {[key: string]: string} {
  // Force the use of the 'Cookie' key if consumers also provide the 'cookie' key
  delete headers.cookie
  delete headers.authorization
  return headers
}
