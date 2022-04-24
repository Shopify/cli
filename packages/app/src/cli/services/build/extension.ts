import {runGoExtensionsCLI, nodeExtensionsCLIPath} from '../../utilities/extensions/cli'
import {path, yaml} from '@shopify/cli-kit'
import {Writable} from 'node:stream'
import {Extension} from '$cli/models/app/app'

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
   * Boolean to specify whether or not to display colors in output
   */
  colors: boolean
}

/**
 * It builds an extension.
 * @param extension {Extension} The extension to build.
 * @param options {ExtensionBuildOptions} Build options.
 */
export async function buildExtension(extension: Extension, options: ExtensionBuildOptions): Promise<void> {
  options.stdout.write(`Building extension...`)
  const stdin = yaml.encode(await extensionConfig(extension))
  await runGoExtensionsCLI(['build', '-'], {
    cwd: extension.directory,
    stdout: options.stdout,
    stderr: options.stderr,
    stdin,
    colors: options.colors,
  })
}

/**
 * The extensions' Go binary receives the build configuration through
 * standard input as a YAML-encoded object. This function returns the
 * Javascript object representing the configuration necessary for building.
 * @param extension {Extension} Extension that will be built.
 * @returns
 */
async function extensionConfig(extension: Extension): Promise<any> {
  return {
    extensions: [
      {
        title: extension.configuration.name,
        type: extension.configuration.type,
        metafields: extension.configuration.metafields,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        node_executable: await nodeExtensionsCLIPath(),
        development: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          root_dir: '.',
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
