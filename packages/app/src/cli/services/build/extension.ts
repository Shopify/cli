import {formatBundleSize} from './bundle-size.js'
import {AppInterface} from '../../models/app/app.js'
import {bundleExtension} from '../extensions/bundle.js'
import {buildGraphqlTypes, buildJSFunction, runTrampoline, runWasmOpt} from '../function/build.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
import {exec} from '@shopify/cli-kit/node/system'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {AbortError, AbortSilentError} from '@shopify/cli-kit/node/error'
import lockfile from 'proper-lockfile'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {copyFile, readFile, touchFile, writeFile, fileExistsSync} from '@shopify/cli-kit/node/fs'
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

  /**
   * When building for a deploy or dev bundle, this is the output path inside the
   * bundle directory. When set, build functions write their final artifact here
   * instead of extension.outputPath. This avoids mutating extension.outputPath at
   * runtime.
   */
  bundleOutputPath?: string
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

  const outputPath = options.bundleOutputPath ?? extension.outputPath
  const {main, assets} = extension.getBundleExtensionStdinContent()

  try {
    await bundleExtension({
      minify: true,
      outputPath,
      stdin: {
        contents: main,
        resolveDir: extension.directory,
        loader: 'tsx',
      },
      environment: options.environment,
      env,
      stderr: options.stderr,
      stdout: options.stdout,
      sourceMaps: extension.isSourceMapGeneratingExtension,
    })
    if (assets) {
      await Promise.all(
        assets.map(async (asset) => {
          await bundleExtension({
            minify: true,
            outputPath: joinPath(dirname(outputPath), asset.outputFileName),
            stdin: {
              contents: asset.content,
              resolveDir: extension.directory,
              loader: 'tsx',
            },
            environment: options.environment,
            env,
            stderr: options.stderr,
            stdout: options.stdout,
          })
        }),
      )
    }
  } catch (extensionBundlingError) {
    // this fails if the app's own source code is broken; wrap such that this isn't flagged as a CLI bug
    throw new AbortError(
      `Failed to bundle extension ${extension.localIdentifier}. Please check the extension source code for errors.`,
    )
  }

  await extension.buildValidation()

  const sizeInfo = await formatBundleSize(outputPath)
  options.stdout.write(`${extension.localIdentifier} successfully built${sizeInfo}`)
}

type BuildFunctionExtensionOptions = ExtensionBuildOptions

/**
 * Builds a function extension
 * @param extension - The function extension to build.
 * @param options - Options to configure the build of the extension.
 */
export async function buildFunctionExtension(
  extension: ExtensionInstance,
  options: BuildFunctionExtensionOptions,
): Promise<void> {
  const lockfilePath = joinPath(extension.directory, '.build-lock')
  let releaseLock
  try {
    releaseLock = await lockfile.lock(extension.directory, {retries: 20, lockfilePath})
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    outputDebug(`Failed to acquire function build lock: ${error.message}`)
    throw new AbortError('Failed to build function.', 'This is likely due to another in-progress build.', [
      'Ensure there are no other function builds in-progress.',
      'Delete the `.build-lock` file in your function directory.',
    ])
  }

  try {
    const relativeBuildPath =
      (extension as ExtensionInstance<FunctionConfigType>).configuration.build?.path ?? extension.outputRelativePath
    const buildOutputPath = joinPath(extension.directory, relativeBuildPath)

    if (extension.isJavaScript) {
      await runCommandOrBuildJSFunction(extension, options, buildOutputPath)
    } else {
      await buildOtherFunction(extension, options)
    }

    const wasmOpt = (extension as ExtensionInstance<FunctionConfigType>).configuration.build?.wasm_opt
    if (fileExistsSync(buildOutputPath) && wasmOpt) {
      await runWasmOpt(buildOutputPath)
    }

    if (fileExistsSync(buildOutputPath)) {
      await runTrampoline(buildOutputPath)
    }

    // When building for a bundle, copy + base64-encode into the bundle directory.
    // This mirrors how buildUIExtension writes directly to bundleOutputPath via esbuild.
    if (options.bundleOutputPath && fileExistsSync(buildOutputPath)) {
      await touchFile(options.bundleOutputPath)
      await copyFile(buildOutputPath, options.bundleOutputPath)
      await bundleFunctionExtension(options.bundleOutputPath)
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    // To avoid random user-code errors being reported as CLI bugs, we capture and rethrow them as AbortError.
    // In this case, we need to keep the ESBuild details for the logs. (the `errors` array).
    // If the error is already an AbortError, we can just rethrow it.
    if (error instanceof AbortError) {
      throw error
    }

    const errorMessage = (error as Error).message ?? 'Unknown error occurred'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newError: any = new AbortError('Failed to build function.', errorMessage)
    // Inject ESBuild errors if present
    newError.errors = error.errors
    throw newError
  } finally {
    await releaseLock()
  }
}

export async function bundleFunctionExtension(wasmPath: string) {
  outputDebug(`Converting WASM to base64 in ${wasmPath}`)
  const base64Contents = await readFile(wasmPath, {encoding: 'base64'})
  await writeFile(wasmPath, base64Contents)
}

async function runCommandOrBuildJSFunction(
  extension: ExtensionInstance,
  options: BuildFunctionExtensionOptions,
  buildOutputPath: string,
) {
  if (extension.buildCommand) {
    if (extension.typegenCommand) {
      await buildGraphqlTypes(extension, options)
    }
    return runCommand(extension.buildCommand, extension, options)
  } else {
    return buildJSFunction(extension as ExtensionInstance<FunctionConfigType>, options, buildOutputPath)
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
  if (extension.typegenCommand) {
    await buildGraphqlTypes(extension, options)
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
