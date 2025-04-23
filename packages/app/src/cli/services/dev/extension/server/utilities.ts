import {ExtensionInstance} from '../../../../models/extensions/extension-instance.js'
import {getUIExtensionResourceURL} from '../../../../utilities/extensions/configuration.js'
import {getExtensionPointTargetSurface} from '../utilities.js'
import {ExtensionsPayloadStoreOptions} from '../payload/store.js'
import {createError, H3Error, ServerResponse, sendError as h3SendError} from 'h3'
import {isSpinEnvironment} from '@shopify/cli-kit/node/context/spin'

export function getRedirectUrl(extension: ExtensionInstance, options: ExtensionsPayloadStoreOptions): string {
  const {url: resourceUrl} = getUIExtensionResourceURL(extension.type, options)

  if (extension.surface === 'checkout' && resourceUrl) {
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

export function getExtensionPointRedirectUrl(
  requestedTarget: string,
  extension: ExtensionInstance,
  options: ExtensionsPayloadStoreOptions,
): string | undefined {
  const surface = getExtensionPointTargetSurface(requestedTarget)
  let rawUrl = new URL(`https://${options.storeFqdn}/`)

  switch (surface) {
    case 'checkout':
      // This can never be null because we always generate it
      // whenever there is an extension point targeting Checkout
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      rawUrl.pathname = options.checkoutCartUrl!
      rawUrl.searchParams.append('dev', `${options.url}/extensions`)
      break
    case 'post_purchase':
      // This can never be null because we always generate it
      // whenever there is an extension point targeting Post Purchase
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      rawUrl.pathname = options.checkoutCartUrl!

      rawUrl.searchParams.set(
        'script_url',
        `${options.url}/extensions/${extension.devUUID}/assets/${extension.localIdentifier}.js`,
      )

      rawUrl.searchParams.set('post_purchase_dev_api_key', options.apiKey)

      // Live reload params
      if (extension.devUUID && options.websocketURL) {
        rawUrl.searchParams.set('uuid', extension.devUUID)
        rawUrl.searchParams.set('socket_url', options.websocketURL)
      }

      if ('metafields' in extension.configuration) {
        const config = {config: {metafields: extension.configuration.metafields}}
        rawUrl.searchParams.set('config', JSON.stringify(config))
      }
      break
    case 'admin':
      rawUrl.pathname = 'admin/extensions-dev'
      rawUrl.searchParams.append('url', getExtensionUrl(extension, options))
      rawUrl.searchParams.append('target', requestedTarget)
      break
    case 'customer-accounts':
      rawUrl = getCustomerAccountsRedirectUrl(extension, options, requestedTarget)
      break
    default:
      return undefined
  }

  return rawUrl.toString()
}

function getCustomerAccountsRedirectUrl(
  extension: ExtensionInstance,
  options: ExtensionsPayloadStoreOptions,
  requestedTarget = '',
): URL {
  const origin = `${options.url}/extensions`
  const storeId = options.storeId
  const [_, ...storeDomainParts] = options.storeFqdn.split('.')
  const customerAccountHost = isSpinEnvironment() ? storeDomainParts.join('.') : 'shopify.com'
  const rawUrl = new URL(`https://${customerAccountHost}/${storeId}/account/extensions-development`)

  rawUrl.searchParams.append('origin', origin)
  rawUrl.searchParams.append('extensionId', extension.devUUID)
  rawUrl.searchParams.append('source', 'CUSTOMER_ACCOUNT_EXTENSION')
  rawUrl.searchParams.append('appId', options.id ?? '')
  if (requestedTarget !== '') {
    rawUrl.searchParams.append('target', requestedTarget)
  }
  return rawUrl
}

export function getExtensionUrl(extension: ExtensionInstance, options: ExtensionsPayloadStoreOptions): string {
  const extensionUrl = new URL(options.url)
  extensionUrl.pathname = `/extensions/${extension.devUUID}`
  return extensionUrl.toString()
}

export function sendError(response: ServerResponse, error: Partial<H3Error>) {
  h3SendError(response.event, createError(error))
}
