import {runGoExtensionsCLI, nodeExtensionsCLIPath} from '../../utilities/extensions/cli'
import {path, yaml} from '@shopify/cli-kit'
import {Writable} from 'node:stream'
import {App, UIExtension} from '$cli/models/app/app'

interface ExtensionBuildOptions {
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
  extension: UIExtension

  /**
   * The app that contains the extension.
   */
  app: App
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

interface ExtensionConfigOptions {
  app: App
  extension: UIExtension
  buildDirectory?: string
}

/**
 * The extensions' Go binary receives the build configuration through
 * standard input as a YAML-encoded object. This function returns the
 * Javascript object representing the configuration necessary for building.
 * @param extension {UIExtension} Extension that will be built.
 * @returns
 */
async function extensionConfig(options: ExtensionConfigOptions): Promise<any> {
  return {
    extensions: [
      {
        title: options.extension.configuration.name,
        type: `${options.extension.configuration.type}_next`,
        metafields: options.extension.configuration.metafields,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        node_executable: await nodeExtensionsCLIPath(),
        development: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          root_dir: path.relative(options.app.directory, options.extension.directory),
          // eslint-disable-next-line @typescript-eslint/naming-convention
          build_dir:
            options.buildDirectory ?? path.relative(options.extension.directory, options.extension.buildDirectory),
          entries: {
            main: path.relative(options.extension.directory, options.extension.entrySourceFilePath),
          },
        },
      },
    ],
  }
}
