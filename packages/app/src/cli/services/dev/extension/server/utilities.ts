import {UIExtension} from '../../../../models/app/extensions.js'
import {getUIExtensionResourceURL} from '../../../../utilities/extensions/configuration.js'
import {ExtensionDevOptions} from '../../extension.js'
import {getExtensionPointTargetSurface} from '../utilities.js'
import * as http from '@shopify/cli-kit/node/http'

export function getRedirectUrl(extension: UIExtension, options: ExtensionDevOptions, previewMode?: string): string {
  const {url: resourceUrl} = getUIExtensionResourceURL(extension.configuration.type, options, previewMode)

  if (extension.surface === 'checkout' && resourceUrl) {
    const rawUrl = new URL(`https://${options.storeFqdn}/`)

    if (previewMode === 'editor') {
      rawUrl.pathname = 'admin/extensions-dev'
      rawUrl.searchParams.append('url', getExtensionUrl(extension, options))
    } else {
      rawUrl.pathname = resourceUrl
      rawUrl.searchParams.append('dev', `${options.url}/extensions`)
    }

    return rawUrl.toString()
  } else {
    const rawUrl = new URL(`https://${options.storeFqdn}/`)
    rawUrl.pathname = 'admin/extensions-dev'
    rawUrl.searchParams.append('url', getExtensionUrl(extension, options))

    return rawUrl.toString()
  }
}

export function getExtensionPointRedirectUrl(
  requestedTarget: string,
  extension: UIExtension,
  options: ExtensionDevOptions,
  previewMode?: string,
): string | undefined {
  const surface = getExtensionPointTargetSurface(requestedTarget)
  const rawUrl = new URL(`https://${options.storeFqdn}/`)

  switch (surface) {
    case 'checkout':
      // This can never be null because we always generate it
      // whenever there is an extension point targeting Checkout
      constructExPointRedirectByPreviewMode(rawUrl, options, extension, previewMode)
      break
    case 'admin':
      rawUrl.pathname = 'admin/extensions-dev'
      rawUrl.searchParams.append('url', getExtensionUrl(extension, options))
      rawUrl.searchParams.append('target', requestedTarget)
      break
    default:
      return undefined
  }

  return rawUrl.toString()
}

function constructExPointRedirectByPreviewMode(
  rawUrl: URL,
  options: ExtensionDevOptions,
  extension: UIExtension,
  previewMode?: string,
) {
  switch (previewMode) {
    case 'editor':
      rawUrl.pathname = 'admin/extensions-dev'
      rawUrl.searchParams.append('url', getExtensionUrl(extension, options))
      break
    default:
      rawUrl.pathname = options.checkoutCartUrl!
      rawUrl.searchParams.append('dev', `${options.url}/extensions`)
  }
}

export function getExtensionUrl(extension: UIExtension, options: ExtensionDevOptions, previewMode?: string): string {
  const extensionUrl = new URL(options.url)
  extensionUrl.pathname = `/extensions/${extension.devUUID}`

  if (previewMode && previewMode === 'editor') {
    extensionUrl.searchParams.append('previewMode', previewMode)
  }

  return extensionUrl.toString()
}

export function sendError(response: http.ServerResponse, error: Partial<http.H3Error>) {
  http.sendError(response.event, http.createError(error))
}
