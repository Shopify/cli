import {runGoExtensionsCLI} from '../../utilities/extensions/cli.js'
import {App, UIExtension, FunctionExtension, ThemeExtension} from '../../models/app/app.js'
import {extensionConfig} from '../../utilities/extensions/configuration.js'
import {error, system, yaml, output} from '@shopify/cli-kit'
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
  await execThemeCheckCLI({
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
  if (options.extensions.length === 0) {
    return
  }
  options.stdout.write(`Building UI extensions...`)
  const fullOptions = {...options, extensions: options.extensions, includeResourceURL: false}
  const configuration = await extensionConfig(fullOptions)
  output.debug(output.content`Dev'ing extension with configuration:
${output.token.json(configuration)}
`)
  const stdin = yaml.encode(configuration)
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
  const buildCommand = extension.configuration.build?.command
  if (!buildCommand || buildCommand.trim() === '') {
    options.stderr.write(
      `The function extension ${extension.localIdentifier} doesn't have a build command or it's empty`,
    )
    options.stderr.write(`
    Edit the shopify.function.extension.toml configuration file and set how to build the extension.

    [build]
    command = "{COMMAND}"

    Note that the command must output a dist/index.wasm file.
    `)
    throw new error.AbortSilent()
  }
  const buildCommandComponents = buildCommand.split(' ')
  options.stdout.write(`Building function ${extension.localIdentifier}...`)
  await system.exec(buildCommandComponents[0], buildCommandComponents.slice(1), {
    stdout: options.stdout,
    stderr: options.stderr,
    cwd: extension.directory,
    signal: options.signal,
  })
}
