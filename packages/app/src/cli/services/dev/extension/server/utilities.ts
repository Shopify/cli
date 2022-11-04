import {getUIExtensionResourceURL, getUIExtensionSurface} from '../../../../utilities/extensions/configuration.js'
import {ExtensionDevOptions} from '../../extension.js'
import {ExtensionInstance} from '../../../../models/extensions/extensions.js'
import {http} from '@shopify/cli-kit'

export function getRedirectUrl(extension: ExtensionInstance, options: ExtensionDevOptions): string {
  const surface = getUIExtensionSurface(extension.configuration.type)
  const {url: resourceUrl} = getUIExtensionResourceURL(extension.configuration.type, options)

  if (surface === 'checkout' && resourceUrl) {
    const rawUrl = new URL(`https://${options.storeFqdn}/`)
    rawUrl.pathname = resourceUrl
    rawUrl.searchParams.append('dev', `${options.url}/extensions`)

    return rawUrl.toString()
  } else {
    const rawUrl = new URL(`https://${options.storeFqdn}/`)
    rawUrl.pathname = 'admin/extensions-dev'
    rawUrl.searchParams.append('url', getExtensionUrl(extension, options))

    return rawUrl.toString()
  }
}

export function getExtensionUrl(extension: ExtensionInstance, options: ExtensionDevOptions): string {
  const extensionUrl = new URL(options.url)
  extensionUrl.pathname = `/extensions/${extension.devUUID}`
  return extensionUrl.toString()
}

export function sendError(response: http.ServerResponse, error: Partial<http.H3Error>) {
  http.sendError(response.event, http.createError(error))
}
