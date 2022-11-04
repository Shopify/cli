import {AppInterface} from '../../models/app/app.js'
import {ExtensionInstance} from '../../models/extensions/extensions.js'
import {abort, output} from '@shopify/cli-kit'
import {execThemeCheckCLI} from '@shopify/cli-kit/node/ruby'
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
  signal: abort.Signal

  /**
   * Overrides the default build directory.
   */
  buildDirectory?: string

  /**
   * The app that contains the extensions.
   */
  app: AppInterface
}

export interface ThemeExtensionBuildOptions extends ExtensionBuildOptions {
  /**
   * The UI extensions to be built.
   */
  extensions: ExtensionInstance[]
}

/**
 * It builds the theme extensions.
 * @param options - Build options.
 */
export async function buildThemeExtensions(options: ThemeExtensionBuildOptions): Promise<void> {
  if (options.extensions.length === 0) return
  options.stdout.write(`Running theme check on your Theme app extension...`)
  const themeDirectories = options.extensions.map((extension) => extension.directory)
  await execThemeCheckCLI({
    directories: themeDirectories,
    args: ['-C', ':theme_app_extension'],
    stdout: options.stdout,
    stderr: options.stderr,
  })
}

interface BuildUIExtensionsOptions {
  app: AppInterface
}

export async function buildUIExtensions(options: BuildUIExtensionsOptions): Promise<output.OutputProcess[]> {
  if (options.app.extensions.ui.length === 0) {
    return []
  }

  return options.app.extensions.ui.map((uiExtension) => {
    return {
      prefix: uiExtension.localIdentifier,
      action: async (stdout: Writable, stderr: Writable, signal: abort.Signal) => {
        await uiExtension.build(stderr, stdout, options.app)
      },
    }
  })
}
