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
}

/**
 * It builds an extension.
 * @param extension {UIExtension} The extension to build.
 * @param options {ExtensionBuildOptions} Build options.
 */
export async function buildExtension(extension: UIExtension, app: App, options: ExtensionBuildOptions): Promise<void> {
  options.stdout.write(`Building extension...`)
  const stdin = yaml.encode(await extensionConfig(extension, app))
  await runGoExtensionsCLI(['build', '-'], {
    cwd: app.directory,
    stdout: options.stdout,
    stderr: options.stderr,
    stdin,
  })
}

/**
 * The extensions' Go binary receives the build configuration through
 * standard input as a YAML-encoded object. This function returns the
 * Javascript object representing the configuration necessary for building.
 * @param extension {UIExtension} Extension that will be built.
 * @returns
 */
async function extensionConfig(extension: UIExtension, app: App): Promise<any> {
  return {
    extensions: [
      {
        title: extension.configuration.name,
        type: `${extension.configuration.type}_next`,
        metafields: extension.configuration.metafields,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        node_executable: await nodeExtensionsCLIPath(),
        development: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          root_dir: path.relative(app.directory, extension.directory),
          // eslint-disable-next-line @typescript-eslint/naming-convention
          build_dir: path.relative(extension.directory, extension.buildDirectory),
          entries: {
            main: path.relative(extension.directory, extension.entrySourceFilePath),
          },
        },
      },
    ],
  }
}
