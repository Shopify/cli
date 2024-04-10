import {BaseProcess, DevProcessFunction} from './types.js'
import {devUIExtensions} from '../extension.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {buildCartURLIfNeeded} from '../extension/utilities.js'
import {DotEnvFile} from '@shopify/cli-kit/node/dot-env'

const MANIFEST_VERSION = '3'

interface PreviewableExtensionOptions {
  apiKey: string
  storeFqdn: string
  storeId: string
  port: number
  pathPrefix: string
  cartUrl?: string
  subscriptionProductUrl?: string
  proxyUrl: string
  appName: string
  appDotEnvFile?: DotEnvFile
  appDirectory: string
  appId?: string
  grantedScopes: string[]
  previewableExtensions: ExtensionInstance[]
}

export interface PreviewableExtensionProcess extends BaseProcess<PreviewableExtensionOptions> {
  type: 'previewable-extension'
}

export const launchPreviewableExtensionProcess: DevProcessFunction<PreviewableExtensionOptions> = async (
  {stderr, stdout, abortSignal},
  {
    apiKey,
    storeFqdn,
    storeId,
    subscriptionProductUrl,
    port,
    cartUrl,
    proxyUrl,
    appName,
    appDotEnvFile,
    appId,
    grantedScopes,
    previewableExtensions,
    appDirectory,
  },
) => {
  await devUIExtensions({
    appName,
    appDotEnvFile,
    appDirectory,
    id: appId,
    extensions: previewableExtensions,
    stdout,
    stderr,
    signal: abortSignal,
    url: proxyUrl,
    port,
    storeFqdn,
    storeId,
    apiKey,
    grantedScopes,
    checkoutCartUrl: cartUrl,
    subscriptionProductUrl,
    manifestVersion: MANIFEST_VERSION,
  })
}

export async function setupPreviewableExtensionsProcess({
  allExtensions,
  storeFqdn,
  checkoutCartUrl,
  ...options
}: Omit<PreviewableExtensionOptions, 'pathPrefix' | 'previewableExtensions' | 'port' | 'cartUrl'> & {
  allExtensions: ExtensionInstance[]
  checkoutCartUrl?: string
}): Promise<PreviewableExtensionProcess | undefined> {
  const previewableExtensions = allExtensions.filter((ext) => ext.isPreviewable)
  if (previewableExtensions.length === 0) {
    return
  }

  const cartUrl = await buildCartURLIfNeeded(previewableExtensions, storeFqdn, checkoutCartUrl)

  return {
    prefix: 'extensions',
    type: 'previewable-extension',
    function: launchPreviewableExtensionProcess,
    options: {
      pathPrefix: '/extensions',
      port: -1,
      storeFqdn,
      previewableExtensions,
      cartUrl,
      ...options,
    },
  }
}
