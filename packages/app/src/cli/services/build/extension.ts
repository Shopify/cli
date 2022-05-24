import {runGoExtensionsCLI, nodeExtensionsCLIPath} from '../../utilities/extensions/cli'
import {App, getUIExtensionRendererVersion, UIExtension} from '../../models/app/app'
import {id, path, yaml} from '@shopify/cli-kit'
import {Writable} from 'node:stream'

export interface ExtensionBuildOptions {
  /**
   * Standard output stream to send the output through.
   */
  stdout: Writable
  /**
   * Standard error stream to send the error output through.
   */
  stderr: Writable

  /**
   * Signal to abort the build process.
   */
  signal: AbortSignal

  /**
   * Overrides the default build directory.
   */
  buildDirectory?: string

  /**
   * The extension to be built.
   */
  extensions: UIExtension[]

  /**
   * The app that contains the extension.
   */
  app: App
}

export interface ExtensionDevOptions {
  /**
   * Standard output stream to send the output through.
   */
  stdout: Writable
  /**
   * Standard error stream to send the error output through.
   */
  stderr: Writable

  /**
   * Signal to abort the build process.
   */
  signal: AbortSignal

  /**
   * Overrides the default build directory.
   */
  buildDirectory?: string

  /**
   * The extension to be built.
   */
  extensions: UIExtension[]

  /**
   * The app that contains the extension.
   */
  app: App

  /**
   * The app identifier
   */
  apiKey: string

  /**
   * URL where the extension is locally served from. It's usually the tunnel URL
   */
  url: string

  /**
   * The port where the extension is hosted.
   * It's usually the tunnel port
   */
  port: number

  /**
   * The development store where the extension wants to be previewed
   */
  storeFqdn: string
}

/**
 * It builds an extension.
 * @param extension {UIExtension} The extension to build.
 * @param options {ExtensionBuildOptions} Build options.
 */
export async function buildExtension(options: ExtensionBuildOptions): Promise<void> {
  options.stdout.write(`Building extension...`)
  const stdin = yaml.encode(await extensionConfig(options))
  await runGoExtensionsCLI(['build', '-'], {
    cwd: options.app.directory,
    stdout: options.stdout,
    stderr: options.stderr,
    stdin,
  })
}

export async function serveExtensions(options: ExtensionDevOptions): Promise<void> {
  options.stdout.write(`Serving extension...`)
  const config = await extensionConfig(options)
  const stdin = yaml.encode(config)
  await runGoExtensionsCLI(['serve', '-'], {
    cwd: options.app.directory,
    stdout: options.stdout,
    stderr: options.stderr,
    stdin,
  })
}

interface ExtensionConfigOptions {
  app: App
  apiKey?: string
  extensions: UIExtension[]
  buildDirectory?: string
  url?: string
  port?: number
  storeFqdn?: string
}

/**
 * The extensions' Go binary receives the build configuration through
 * standard input as a YAML-encoded object. This function returns the
 * Javascript object representing the configuration necessary for building.
 * @param extension {UIExtension} Extension that will be built.
 * @returns
 */
export async function extensionConfig(options: ExtensionConfigOptions): Promise<any> {
  const extensionsConfig = await Promise.all(
    options.extensions.map(async (extension) => {
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
