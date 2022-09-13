import {AppInterface} from '../../models/app/app.js'
import {UIExtension} from '../../models/app/extensions.js'
import {runGoExtensionsCLI} from '../../utilities/extensions/cli.js'
import {extensionConfig} from '../../utilities/extensions/configuration.js'
import {yaml, output, abort} from '@shopify/cli-kit'
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
  signal: abort.Signal

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
  app: AppInterface

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

  /**
   * Product variant ID, used for checkout_ui_extensions
   * If that extension is present, this is mandatory
   */
  cartUrl?: string

  /**
   * Subscription product URL, used for subscription_ui_extensions
   * If not provided the first product in the store will be used
   */
  subscriptionProductUrl?: string
}

export async function devExtensions(options: ExtensionDevOptions): Promise<void> {
  const config = await extensionConfig({includeResourceURL: true, ...options})
  output.debug(output.content`Dev'ing extension with configuration:
${output.token.json(config)}
`)
  const input = yaml.encode(config)
  await runGoExtensionsCLI(['serve', '-'], {
    cwd: options.app.directory,
    signal: options.signal,
    stdout: options.stdout,
    stderr: options.stderr,
    input,
  })
}
