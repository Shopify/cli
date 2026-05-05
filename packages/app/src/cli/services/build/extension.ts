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
import {outputDebug, outputWarn} from '@shopify/cli-kit/node/output'
import {readFile, touchFile, writeFile, fileExistsSync} from '@shopify/cli-kit/node/fs'
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
 * It builds the UI extensions.
 * @param options - Build options.
 * @returns The local output path.
 */
export async function buildUIExtension(extension: ExtensionInstance, options: ExtensionBuildOptions): Promise<string> {
  options.stdout.write(`Bundling UI extension ${extension.localIdentifier}...`)
  const env = options.app.dotenv?.variables ?? {}
  if (options.appURL) {
    env.APP_URL = options.appURL
  }

  const buildDirectory = options.buildDirectory ?? ''

  // Always build into the extension's local directory (e.g. ext/dist/handle.js)
  const localOutputPath = joinPath(extension.directory, buildDirectory, extension.outputRelativePath)

  const {main, assets} = extension.getBundleExtensionStdinContent()

  const startTime = performance.now()
  try {
    await bundleExtension({
      minify: true,
      outputPath: localOutputPath,
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
            outputPath: joinPath(dirname(localOutputPath), asset.outputFileName),
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (extensionBundlingError: any) {
    // this fails if the app's own source code is broken; wrap such that this isn't flagged as a CLI bug
    // Preserve esbuild errors array so the dev watcher can format actionable error messages
    const errorMessage = (extensionBundlingError as Error).message ?? 'Unknown error occurred'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newError: any = new AbortError(
      `Failed to bundle extension ${extension.localIdentifier}. Please check the extension source code for errors.`,
      errorMessage,
    )
    newError.errors = extensionBundlingError.errors
    throw newError
  }

  await extension.buildValidation({outputPath: localOutputPath})

  const duration = Math.round(performance.now() - startTime)
  const sizeInfo = await formatBundleSize(localOutputPath)
  options.stdout.write(`${extension.localIdentifier} successfully built in ${duration}ms${sizeInfo}`)
  return localOutputPath
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
  await warnIfSchemaMismatch(extension as ExtensionInstance<FunctionConfigType>)

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
    const bundlePath = extension.outputPath
    const relativeBuildPath =
      (extension as ExtensionInstance<FunctionConfigType>).configuration.build?.path ?? extension.outputRelativePath

    extension.outputPath = joinPath(extension.directory, relativeBuildPath)

    if (extension.isJavaScript) {
      await runCommandOrBuildJSFunction(extension, options)
    } else {
      await buildOtherFunction(extension, options)
    }

    const wasmOpt = (extension as ExtensionInstance<FunctionConfigType>).configuration.build?.wasm_opt
    if (fileExistsSync(extension.outputPath) && wasmOpt) {
      await runWasmOpt(extension.outputPath)
    }

    if (fileExistsSync(extension.outputPath)) {
      await runTrampoline(extension.outputPath)
    }

    const projectOutputPath = joinPath(extension.directory, extension.outputRelativePath)

    if (
      fileExistsSync(extension.outputPath) &&
      bundlePath !== extension.outputPath &&
      bundlePath !== projectOutputPath &&
      dirname(bundlePath) !== dirname(extension.outputPath)
    ) {
      // Bundle build for deploy: base64-encode into the bundle directory
      await bundleFunctionExtension(extension.outputPath, bundlePath)
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

export async function bundleFunctionExtension(wasmPath: string, bundlePath: string) {
  outputDebug(`Converting WASM from ${wasmPath} to base64 in ${bundlePath}`)
  const base64Contents = await readFile(wasmPath, {encoding: 'base64'})
  await touchFile(bundlePath)
  await writeFile(bundlePath, base64Contents)
}

async function runCommandOrBuildJSFunction(extension: ExtensionInstance, options: BuildFunctionExtensionOptions) {
  if (extension.buildCommand) {
    if (extension.typegenCommand) {
      await buildGraphqlTypes(extension, options)
    }
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
  if (extension.typegenCommand) {
    await buildGraphqlTypes(extension, options)
  }
  return runCommand(extension.buildCommand, extension, options)
}

const API_VERSION_DIRECTIVE_RE = /@apiVersion\(version:\s*"([^"]+)"\)/

async function warnIfSchemaMismatch(extension: ExtensionInstance<FunctionConfigType>) {
  const schemaPath = joinPath(extension.directory, 'schema.graphql')
  let content: string
  try {
    content = await readFile(schemaPath)
  } catch (error) {
    if (error instanceof Error && 'code' in error) return
    throw error
  }

  const match = API_VERSION_DIRECTIVE_RE.exec(content)
  if (!match) return

  const schemaVersion = match[1]!
  const tomlVersion = extension.configuration.api_version
  if (schemaVersion !== tomlVersion) {
    outputWarn(
      `schema.graphql was generated for API version ${schemaVersion} but your extension targets ${tomlVersion}. Run \`shopify app function schema\` to update.`,
    )
  }
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
