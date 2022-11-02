import {AppInterface} from '../../models/app/app.js'
import {UIExtension, FunctionExtension, ThemeExtension} from '../../models/app/extensions.js'
import {bundleExtension} from '../extensions/bundle.js'
import {error, system, abort, output} from '@shopify/cli-kit'
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
  extensions: ThemeExtension[]
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
        await buildUIExtension(uiExtension, {stdout, stderr, signal, app: options.app})
      },
    }
  })
}

/**
 * It builds the UI extensions.
 * @param options - Build options.
 */
export async function buildUIExtension(extension: UIExtension, options: ExtensionBuildOptions): Promise<void> {
  options.stdout.write(`Bundling UI extension ${extension.localIdentifier}...`)

  await bundleExtension({
    minify: true,
    outputBundlePath: extension.outputBundlePath,
    sourceFilePath: extension.entrySourceFilePath,
    environment: 'production',
    env: options.app.dotenv?.variables ?? {},
    stderr: options.stderr,
    stdout: options.stdout,
  })

  options.stdout.write(`${extension.localIdentifier} successfully built`)
}

export interface BuildFunctionExtensionOptions extends ExtensionBuildOptions {}

/**
 * Builds a function extension
 * @param extension - The function extension to build.
 * @param options - Options to configure the build of the extension.
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
  await system.exec(buildCommandComponents[0]!, buildCommandComponents.slice(1), {
    stdout: options.stdout,
    stderr: options.stderr,
    cwd: extension.directory,
    signal: options.signal,
  })
}
