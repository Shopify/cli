import {nodeExtensionsCLIPath} from './cli.js'
import {mapExtensionTypeToExternalExtensionType} from './name-mapper.js'
import {AppInterface, getUIExtensionRendererVersion} from '../../models/app/app.js'
import {UIExtension} from '../../models/app/extensions.js'
import {UIExtensionTypes} from '../../constants.js'
import {error, path} from '@shopify/cli-kit'

const RendererNotFoundBug = (extension: string) => {
  return new error.Bug(
    `Couldn't find renderer version for extension ${extension}`,
    'Make sure you have all your dependencies up to date',
  )
}
export interface ExtensionConfigOptions {
  app: AppInterface
  apiKey?: string
  extensions: UIExtension[]
  buildDirectory?: string
  url?: string
  port?: number
  storeFqdn?: string
  includeResourceURL?: boolean
  checkoutCartUrl?: string
  subscriptionProductUrl?: string
  resourceUrl?: string
  grantedScopes?: string[]
}

/**
 * The extensions' Go binary receives the configuration through
 * standard input as a YAML-encoded object. This function returns the
 * Javascript object representing the configuration necessary for building.
 * @param extension - Extension that will be built.
 */
export async function extensionConfig(options: ExtensionConfigOptions): Promise<unknown> {
  const extensionsConfig = await Promise.all(
    options.extensions.map(async (extension) => {
      const renderer = await getUIExtensionRendererVersion(extension.configuration.type, options.app)
      if (renderer === 'not_found') throw RendererNotFoundBug(extension.configuration.type)
      return {
        uuid: extension.devUUID,
        title: extension.configuration.name,
        type: `${extension.configuration.type}`,
        external_type: mapExtensionTypeToExternalExtensionType(extension.configuration.type),
        metafields: extension.configuration.metafields,
        extension_points: extension.configuration.extensionPoints || [],
        categories: extension.configuration.categories || [],
        node_executable: await nodeExtensionsCLIPath(),
        surface: getUIExtensionSurface(extension.configuration.type),
        version: renderer?.version,
        development: {
          root_dir: path.relative(options.app.directory, extension.directory),
          build_dir: options.buildDirectory
            ? path.relative(extension.directory, options.buildDirectory)
            : path.relative(extension.directory, path.dirname(extension.outputBundlePath)),
          entries: {
            main: path.relative(extension.directory, extension.entrySourceFilePath),
          },
          renderer,
          resource: options.includeResourceURL
            ? await getUIExtensionResourceURL(extension.configuration.type, options)
            : null,
          build: {
            env: options.app.dotenv?.variables ?? {},
          },
          develop: {
            env: options.app.dotenv?.variables ?? {},
          },
        },
        capabilities: extension.configuration.capabilities,
        approval_scopes: options.grantedScopes ?? [],
      }
    }),
  )

  return {
    public_url: options.url,
    port: options.port,
    store: options.storeFqdn,
    app: {
      api_key: options.apiKey,
    },
    extensions: extensionsConfig,
  }
}
type GetUIExensionResourceURLOptions = Pick<ExtensionConfigOptions, 'checkoutCartUrl' | 'subscriptionProductUrl' | 'resourceUrl'>
export function getUIExtensionResourceURL(
  uiExtensionType: UIExtensionTypes,
  options: GetUIExensionResourceURLOptions,
): {url: string | undefined} {
  switch (uiExtensionType) {
    case 'checkout_ui_extension':
      return {url: options.checkoutCartUrl}
    case 'checkout_post_purchase':
    case 'pos_ui_extension':
    case 'web_pixel_extension':
    case 'customer_accounts_ui_extension':
      return {url: ''}
    case 'product_subscription':
      return {url: options.subscriptionProductUrl ?? ''}
    case 'od_ui_extension':
      return {url: options.resourceUrl ?? ''}
    case 'dod_ui_extension':
      return {url: options.resourceUrl ?? ''}
    case 'doc_ui_extension':
      return {url: options.resourceUrl ?? ''}
  }
}

export type UIExtensionSurface = ReturnType<typeof getUIExtensionSurface>

export function getUIExtensionSurface(uiExtensionType: UIExtensionTypes) {
  switch (uiExtensionType) {
    case 'checkout_ui_extension':
      return 'checkout'
    case 'checkout_post_purchase':
      return 'post_purchase'
    case 'customer_accounts_ui_extension':
      return 'customer_accounts'
    case 'pos_ui_extension':
      return 'pos'
    case 'od_ui_extension':
    case 'dod_ui_extension':
    case 'doc_ui_extension':
    case 'product_subscription':
      return 'admin'
    case 'web_pixel_extension':
      // This value is mandatory but is not yet defined for web_pixel
      return 'unknown'
  }
}
