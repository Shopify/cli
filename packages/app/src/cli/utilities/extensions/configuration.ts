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
  cartUrl?: string
  subscriptionProductUrl?: string
}

/**
 * The extensions' Go binary receives the configuration through
 * standard input as a YAML-encoded object. This function returns the
 * Javascript object representing the configuration necessary for building.
 * @param extension {UIExtension} Extension that will be built.
 * @returns
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

export async function getUIExtensionResourceURL(uiExtensionType: UIExtensionTypes, options: ExtensionConfigOptions) {
  switch (uiExtensionType) {
    case 'checkout_ui_extension':
      return {url: options.cartUrl}
    case 'checkout_post_purchase':
    case 'pos_ui_extension':
    case 'web_pixel_extension':
    case 'customer_accounts_ui_extension':
      // This is a temporary workaround to avoid Admin crash when dev'ing multiple extensions
      // Issue at shopify/web: https://github.com/Shopify/web/blob/main/app/components/Extensions/hooks/useResourceUrlQuery.ts#L15-L37
      return {url: 'invalid_url'}
    case 'product_subscription':
      return {url: options.subscriptionProductUrl}
  }
}

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
    case 'product_subscription':
      return 'admin'
    case 'web_pixel_extension':
      // This value is mandatory but is not yet defined for web_pixel
      return 'unknown'
  }
}
