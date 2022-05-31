import {runGoExtensionsCLI} from '../../utilities/extensions/cli'
import {App, UIExtension} from '../../models/app/app'
import {extensionConfig} from '../../utilities/extensions/configuration'
import {error, yaml} from '@shopify/cli-kit'
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
  signal: error.AbortSignal

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
   * Whether to include the resource URL in the configuration. No need when just building
   */
  includeResourceURL: false
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
