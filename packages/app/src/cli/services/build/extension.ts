import {runGoExtensionsCLI} from '../../utilities/extensions/cli'
import {App, UIExtension, FunctionExtension, ThemeExtension} from '../../models/app/app'
import {extensionConfig} from '../../utilities/extensions/configuration'
import {error, ruby, system, yaml} from '@shopify/cli-kit'
import {Writable} from 'node:stream'

export const MissingBuildCommandError = (extensionIdentifier: string) => {
  return new error.Abort(
    `The function extension ${extensionIdentifier} doesn't have a build command or it's empty`,
    `
Edit the shopify.function.extension.toml configuration file and set how to build the extension.

[commands]
build = "{COMMAND}"

Note that the command must output a dist/index.wasm file.
  `,
  )
}

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
  if (options.extensions.length === 0) return
  options.stdout.write(`Building theme extensions...`)
  const themeDirectories = options.extensions.map((extension) => extension.directory)
  await ruby.execThemeCheckCLI({
    directories: themeDirectories,
    args: ['-C', ':theme_app_extension'],
    stdout: options.stdout,
    stderr: options.stderr,
  })
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
  const fullOptions = {...options, extensions: options.extensions, includeResourceURL: false}
  const stdin = yaml.encode(await extensionConfig(fullOptions))
  await runGoExtensionsCLI(['build', '-'], {
    cwd: options.app.directory,
    stdout: options.stdout,
    stderr: options.stderr,
    stdin,
  })
}

export interface BuildFunctionExtensionOptions extends ExtensionBuildOptions {}

/**
 * Builds a function extension
 * @param extension {FunctionExtension} The function extension to build.
 * @param options {BuildFunctionExtensionOptions} Options to configure the build of the extension.
 */
export async function buildFunctionExtension(
  extension: FunctionExtension,
  options: BuildFunctionExtensionOptions,
): Promise<void> {
  const buildCommand = extension.configuration.commands.build
  if (!buildCommand || buildCommand.trim() === '') {
    throw MissingBuildCommandError(extension.localIdentifier)
  }
  const buildCommandComponents = buildCommand.split(' ')

  await system.exec(buildCommandComponents[0], buildCommandComponents.slice(1), {
    stdout: options.stdout,
    stderr: options.stderr,
    cwd: extension.directory,
    signal: options.signal,
  })
}
