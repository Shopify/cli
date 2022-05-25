import {nodeExtensionsCLIPath} from './cli'
import {App, UIExtension, getUIExtensionRendererVersion} from '../../models/app/app'
import {id, path} from '@shopify/cli-kit'

export interface ExtensionConfigOptions {
  app: App
  apiKey?: string
  extensions: UIExtension[]
  buildDirectory?: string
  url?: string
  port?: number
  storeFqdn?: string
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
      // This is a temporary workaround to avoid Admin crash when dev'ing multiple extensions
      // Issue at shopify/web: https://github.com/Shopify/web/blob/main/app/components/Extensions/hooks/useResourceUrlQuery.ts#L15-L37
      const resource = extension.configuration.type === 'product_subscription' ? undefined : {url: 'invalid_url'}
      return {
        uuid: `${extension.configuration.name}-${id.generateShortId()}`,
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
          resource,
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
