import {runThemeCheck} from './theme-check.js'
import {AppInterface} from '../../models/app/app.js'
import {bundleExtension} from '../extensions/bundle.js'
import {buildJSFunction} from '../function/build.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
import {exec} from '@shopify/cli-kit/node/system'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {AbortSilentError} from '@shopify/cli-kit/node/error'
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

  /**
   * The environment to build the extension.
   * Default value: production
   */
  environment: 'production' | 'development'

  /**
   * The URL where the app is running.
   */
  appURL?: string
}

/**
 * It builds the theme extensions.
 * @param options - Build options.
 */
export async function buildThemeExtension(extension: ExtensionInstance, options: ExtensionBuildOptions): Promise<void> {
  options.stdout.write(`Running theme check on your Theme app extension...`)
  const offenses = await runThemeCheck(extension.buildDirectory)
  options.stdout.write(offenses)
}

/**
 * It builds the UI extensions.
 * @param options - Build options.
 */
export async function buildUIExtension(extension: ExtensionInstance, options: ExtensionBuildOptions): Promise<void> {
  options.stdout.write(`Bundling UI extension ${extension.localIdentifier}...`)
  const env = options.app.dotenv?.variables ?? {}
  if (options.appURL) {
    env.APP_URL = options.appURL
  }

  await bundleExtension({
    minify: true,
    outputPath: extension.outputPath,
    stdin: {
      contents: extension.getBundleExtensionStdinContent(),
      resolveDir: extension.directory,
      loader: 'tsx',
    },
    environment: options.environment,
    env,
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
  extension: ExtensionInstance,
  options: BuildFunctionExtensionOptions,
): Promise<void> {
  if (extension.isJavaScript) {
    return runCommandOrBuildJSFunction(extension, options)
  } else {
    return buildOtherFunction(extension, options)
  }
}

async function runCommandOrBuildJSFunction(extension: ExtensionInstance, options: BuildFunctionExtensionOptions) {
  if (extension.buildCommand) {
    return runCommand(extension.buildCommand, extension, options)
  } else {
    return buildJSFunction(extension as ExtensionInstance<FunctionConfigType>, options)
  }
}

async function buildOtherFunction(extension: ExtensionInstance, options: BuildFunctionExtensionOptions) {
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

async function runCommand(buildCommand: string, extension: ExtensionInstance, options: BuildFunctionExtensionOptions) {
  const buildCommandComponents = buildCommand.split(' ')
  options.stdout.write(`Building function ${extension.localIdentifier}...`)
  await exec(buildCommandComponents[0]!, buildCommandComponents.slice(1), {
    stdout: options.stdout,
    stderr: options.stderr,
    cwd: extension.directory,
    signal: options.signal,
  })
}
