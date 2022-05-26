import {runGoExtensionsCLI} from '../../utilities/extensions/cli'
import {App, UIExtension, ThemeExtension} from '../../models/app/app'
import {extensionConfig} from '../../utilities/extensions/configuration'
import {error, ruby, yaml} from '@shopify/cli-kit'
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
   * The app that contains the extensions.
   */
  app: App
}

export interface ThemeExtensionBuildOptions extends ExtensionBuildOptions {
  /**
   * The UI extensions to be built.
   */
  extensions: ThemeExtension[]
}

/**
 * It builds the theme extensions.
 * @param options {ThemeExtensionBuildOptions} Build options.
 */
export async function buildThemeExtensions(options: ThemeExtensionBuildOptions): Promise<void> {
  options.stdout.write(`Building theme extensions...`)
  const themeDirectories = options.extensions.map((extension) => extension.directory)
  await ruby.execThemeCheckCLI({directories: themeDirectories, stdout: options.stdout, stderr: options.stderr})
}

export interface UiExtensionBuildOptions extends ExtensionBuildOptions {
  /**
   * The UI extensions to be built.
   */
  extensions: UIExtension[]
}

/**
 * It builds the UI extensions.
 * @param options {UiExtensionBuildOptions} Build options.
 */
export async function buildUIExtensions(options: UiExtensionBuildOptions): Promise<void> {
  options.stdout.write(`Building UI extensions...`)
  const stdin = yaml.encode(await extensionConfig({...options, extensions: options.extensions}))
  await runGoExtensionsCLI(['build', '-'], {
    cwd: options.app.directory,
    stdout: options.stdout,
    stderr: options.stderr,
    stdin,
  })
}
