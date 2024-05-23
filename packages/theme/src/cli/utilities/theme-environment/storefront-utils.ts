import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'

export function storefrontReplaceTemplatesParams(replaceTemplates: {[key: string]: string}): URLSearchParams {
  /**
   * Theme access proxy doesn't support FormData encoding.
   */
  const params = new URLSearchParams()

  for (const [path, content] of Object.entries(replaceTemplates)) {
    params.append(`replace_templates[${path}]`, content)
  }

  params.append('_method', 'GET')

  return params
}

export function defaultHeaders() {
  return {
    'User-Agent': `Shopify CLI; v=${CLI_KIT_VERSION}`,
  }
}
