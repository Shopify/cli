import {nodeExtensionsCLIPath} from './cli'
import {fetchProductVariant} from './fetch-product-variant'
import {App, UIExtension, getUIExtensionRendererVersion} from '../../models/app/app'
import {error, id, path, string} from '@shopify/cli-kit'
import {UIExtensionTypes} from 'cli/constants'

const MissingStoreError = () => new error.Bug('You need a store to test "checkout_ui_extensions"')

export interface ExtensionConfigOptions {
  app: App
  apiKey?: string
  extensions: UIExtension[]
  buildDirectory?: string
  url?: string
  port?: number
  storeFqdn?: string
  includeResourceURL?: boolean
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
      return {
        uuid: string.hyphenize(`${extension.localIdentifier}-${id.generateShortId()}`),
        title: extension.configuration.name,
        type: `${extension.configuration.type}`,
        metafields: extension.configuration.metafields,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        extension_points: [],
        // eslint-disable-next-line @typescript-eslint/naming-convention
        node_executable: await nodeExtensionsCLIPath(),
        development: {
          version: '1.0.0',
          // eslint-disable-next-line @typescript-eslint/naming-convention
          root_dir: path.relative(options.app.directory, extension.directory),
          // eslint-disable-next-line @typescript-eslint/naming-convention
          build_dir: options.buildDirectory
            ? path.relative(extension.directory, options.buildDirectory)
            : path.relative(extension.directory, extension.buildDirectory),
          entries: {
            main: path.relative(extension.directory, extension.entrySourceFilePath),
          },
          renderer: getUIExtensionRendererVersion(extension.configuration.type, options.app),
          resource: options.includeResourceURL
            ? await getUIExtensionResourceURL(extension.configuration.type, options.storeFqdn)
            : null,
        },
      }
    }),
  )

  return {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    public_url: options.url,
    port: options.port,
    store: options.storeFqdn,
    app: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      api_key: options.apiKey,
    },
    extensions: extensionsConfig,
  }
}

export async function getUIExtensionResourceURL(uiExtensionType: UIExtensionTypes, store?: string) {
  switch (uiExtensionType) {
    case 'checkout_ui_extension': {
      if (!store) throw MissingStoreError()
      const result = await fetchProductVariant(store)
      return {url: `/cart/${result}:1`}
    }
    case 'checkout_post_purchase':
    case 'pos_ui_extension':
    case 'web_pixel_extension':
      // This is a temporary workaround to avoid Admin crash when dev'ing multiple extensions
      // Issue at shopify/web: https://github.com/Shopify/web/blob/main/app/components/Extensions/hooks/useResourceUrlQuery.ts#L15-L37
      return {url: 'invalid_url'}
    case 'product_subscription':
      return undefined
  }
}
