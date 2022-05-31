import {App, UIExtension} from '../../models/app/app'
import {runGoExtensionsCLI} from '../../utilities/extensions/cli'
import {extensionConfig} from '../../utilities/extensions/configuration'
import {error, yaml} from '@shopify/cli-kit'
import {Writable} from 'node:stream'

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

export async function devExtensions(options: ExtensionDevOptions): Promise<void> {
  const config = await extensionConfig({includeResourceURL: true, ...options})
  const stdin = yaml.encode(config)
  await runGoExtensionsCLI(['serve', '-'], {
    cwd: options.app.directory,
    stdout: options.stdout,
    stderr: options.stderr,
    stdin,
  })
}
