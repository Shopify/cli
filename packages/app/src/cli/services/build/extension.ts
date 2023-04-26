import {AppInterface} from '../../models/app/app.js'
import {UIExtension, FunctionExtension, ThemeExtension} from '../../models/app/extensions.js'
import {bundleExtension} from '../extensions/bundle.js'
import {buildJSFunction} from '../function/build.js'
import {execThemeCheckCLI} from '@shopify/cli-kit/node/ruby'
import {exec} from '@shopify/cli-kit/node/system'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {AbortSilentError} from '@shopify/cli-kit/node/error'
import {OutputProcess} from '@shopify/cli-kit/node/output'
import {Writable} from 'stream'

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
  signal?: AbortSignal

  /**
   * Overrides the default build directory.
   */
  buildDirectory?: string

  /**
   * Use tasks to build the extension.
   */
  useTasks?: boolean

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

export async function buildUIExtensions(options: BuildUIExtensionsOptions): Promise<OutputProcess[]> {
  if (options.app.extensions.ui.length === 0) {
    return []
  }

  return options.app.extensions.ui.map((uiExtension) => {
    return {
      prefix: uiExtension.localIdentifier,
      action: async (stdout: Writable, stderr: Writable, signal: AbortSignal) => {
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
    stdin: {
      contents: extension.getBundleExtensionStdinContent(),
      resolveDir: extension.directory,
      loader: 'tsx',
    },
    environment: 'production',
    env: options.app.dotenv?.variables ?? {},
    stderr: options.stderr,
    stdout: options.stdout,
  })

  await extension.buildValidation()

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
  if (extension.isJavaScript) {
    return runCommandOrBuildJSFunction(extension, options)
  } else {
    return buildOtherFunction(extension, options)
  }
}

async function runCommandOrBuildJSFunction(extension: FunctionExtension, options: BuildFunctionExtensionOptions) {
  if (extension.buildCommand) {
    return runCommand(extension.buildCommand, extension, options)
  } else {
    return buildJSFunction(extension, options)
  }
}

async function buildOtherFunction(extension: FunctionExtension, options: BuildFunctionExtensionOptions) {
  if (!extension.buildCommand) {
    options.stderr.write(
      `The function extension ${extension.localIdentifier} doesn't have a build command or it's empty`,
    )
    options.stderr.write(`
    Edit the shopify.function.extension.toml configuration file and set how to build the extension.

    [build]
    command = "{COMMAND}"

    Note that the command must output a dist/index.wasm file.
    `)
    throw new AbortSilentError()
  }
  return runCommand(extension.buildCommand, extension, options)
}

async function runCommand(buildCommand: string, extension: FunctionExtension, options: BuildFunctionExtensionOptions) {
  const buildCommandComponents = buildCommand.split(' ')
  options.stdout.write(`Building function ${extension.localIdentifier}...`)
  await exec(buildCommandComponents[0]!, buildCommandComponents.slice(1), {
    stdout: options.stdout,
    stderr: options.stderr,
    cwd: extension.directory,
    signal: options.signal,
  })
}
