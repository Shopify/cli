import {ExtensionBuildOptions} from '../build/extension.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {themeExtensionFiles} from '../../utilities/extensions/theme.js'
import {EsbuildEnvVarRegex, environmentVariableNames} from '../../constants.js'
import {context as esContext, formatMessagesSync} from 'esbuild'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {copyFile, glob} from '@shopify/cli-kit/node/fs'
import {joinPath, relativePath} from '@shopify/cli-kit/node/path'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {isTruthy} from '@shopify/cli-kit/node/context/utilities'
import {pickBy} from '@shopify/cli-kit/common/object'
import graphqlLoaderPlugin from '@luckycatfactory/esbuild-graphql-loader'
import {Writable} from 'stream'
import type {StdinOptions, build as esBuild, Plugin} from 'esbuild'

interface BundleOptions {
  minify: boolean
  env: {[variable: string]: string}
  outputPath: string
  stdin: StdinOptions
  stdout: Writable
  stderr: Writable

  /**
   * This signal allows the caller to stop the watching process.
   */
  watchSignal?: AbortSignal

  /**
   * Context:
   * When the bundling extension lived in the Go binary, we tied the environment
   * to the workflow being executed (i.e. development when running dev and production
   * when running build) and expoed it through environment variables globally defined
   * by ESBuild. This is a pattern we want to move away from because commands and
   * environments are two different things. However, to do so we need to come up
   * with a migration plan.
   */
  environment: 'development' | 'production'

  /**
   * Whether or not to generate source maps.
   */
  sourceMaps?: boolean

  /**
   * Whether or not to log messages to the console.
   */
  logLevel?: 'silent' | 'error'
}

/**
 * Invokes ESBuild with the given options to bundle an extension.
 * @param options - ESBuild options
 * @param processEnv - Environment variables for the running process (not those from .env)
 */
export async function bundleExtension(options: BundleOptions, processEnv = process.env) {
  const esbuildOptions = getESBuildOptions(options, processEnv)
  const context = await esContext(esbuildOptions)
  const result = await context.rebuild()
  onResult(result, options)
  await context.dispose()
}

export async function bundleThemeExtension(
  extension: ExtensionInstance,
  options: ExtensionBuildOptions,
): Promise<void> {
  options.stdout.write(`Bundling theme extension ${extension.localIdentifier}...`)
  const files = await themeExtensionFiles(extension)

  await copyFiles(files, extension.directory, extension.outputPath)
}

export async function copyFilesForExtension(
  extension: ExtensionInstance,
  options: ExtensionBuildOptions,
  includePatterns: string[],
  ignoredPatterns: string[] = [],
): Promise<void> {
  options.stdout.write(`Copying files for extension ${extension.localIdentifier}...`)
  const include = includePatterns.map((pattern) => joinPath('**', pattern))
  const ignored = ignoredPatterns.map((pattern) => joinPath('**', pattern))
  const files = await glob(include, {
    absolute: true,
    cwd: extension.directory,
    ignore: ignored,
  })

  await copyFiles(files, extension.directory, extension.outputPath)

  options.stdout.write(`${extension.localIdentifier} successfully built`)
}

function onResult(result: Awaited<ReturnType<typeof esBuild>> | null, options: BundleOptions) {
  const warnings = result?.warnings ?? []
  const errors = result?.errors ?? []
  if (warnings.length > 0) {
    const formattedWarnings = formatMessagesSync(warnings, {kind: 'warning'})
    formattedWarnings.forEach((warning) => {
      options.stdout.write(warning)
    })
  }
  if (errors.length > 0) {
    const formattedErrors = formatMessagesSync(errors, {kind: 'error'})
    formattedErrors.forEach((error) => {
      options.stderr.write(error)
    })
  }
}

async function copyFiles(files: string[], directory: string, outputPath: string): Promise<void> {
  const results = await Promise.allSettled(
    files.map(async function (filepath) {
      const relativePathName = relativePath(directory, filepath)
      const outputFile = joinPath(outputPath, relativePathName)
      if (filepath === outputFile) return {status: 'skipped', filepath}

      try {
        await copyFile(filepath, outputFile)
        return {status: 'success', filepath}
        // eslint-disable-next-line no-catch-all/no-catch-all
      } catch (error) {
        // Log warning but don't fail the entire process
        // We intentionally catch all errors here to continue copying other files
        outputDebug(`Failed to copy file ${filepath}: ${error}`)
        return {status: 'failed', filepath, error}
      }
    }),
  )

  // Report any failures as warnings
  const failures = results.filter((result) => {
    return result.status === 'rejected' || (result.status === 'fulfilled' && result.value?.status === 'failed')
  })

  if (failures.length > 0) {
    const failedFiles = failures.map((failure) => {
      if (failure.status === 'rejected') return 'unknown file'
      const value = (failure as PromiseFulfilledResult<{status: string; filepath: string}>).value
      return value.filepath
    })
    outputDebug(`Warning: ${failures.length} file(s) could not be copied: ${failedFiles.join(', ')}`)
  }
}

export function getESBuildOptions(options: BundleOptions, processEnv = process.env): Parameters<typeof esContext>[0] {
  const validEnvs = pickBy(processEnv, (value, key) => EsbuildEnvVarRegex.test(key) && value)

  const env: {[variable: string]: string | undefined} = {...options.env, ...validEnvs}
  const define = Object.keys(env || {}).reduce(
    (acc, key) => ({
      ...acc,
      [`process.env.${key}`]: JSON.stringify(env[key]),
    }),
    {'process.env.NODE_ENV': JSON.stringify(options.environment)},
  )
  const esbuildOptions: Parameters<typeof esContext>[0] = {
    outfile: options.outputPath,
    stdin: options.stdin,
    bundle: true,
    define,
    jsx: 'automatic',
    logLevel: options.logLevel ?? 'error',
    loader: {
      '.esnext': 'ts',
      '.js': 'jsx',
    },
    legalComments: 'none',
    minify: options.minify,
    plugins: getPlugins(options.stdin.resolveDir, processEnv),
    target: 'es6',
    resolveExtensions: ['.tsx', '.ts', '.js', '.json', '.esnext', '.mjs', '.ejs'],
  }

  if (options.sourceMaps) {
    esbuildOptions.sourcemap = true
    esbuildOptions.sourceRoot = `${options.stdin.resolveDir}/src`
  }
  return esbuildOptions
}

/**
 * It returns the plugins that should be used with ESBuild.
 * @returns List of plugins.
 */
function getPlugins(resolveDir: string | undefined, processEnv = process.env): Plugin[] {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const plugins: Plugin[] = [graphqlLoaderPlugin.default()]

  const skipReactDeduplication = isTruthy(processEnv[environmentVariableNames.skipEsbuildReactDedeuplication])
  if (resolveDir && !skipReactDeduplication) {
    let resolvedReactPath: string | undefined
    try {
      resolvedReactPath = require.resolve('react', {paths: [resolveDir]})
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch {
      // If weren't able to find React, that's fine. It might not be used.
      outputDebug(`Unable to load React in ${resolveDir}, skipping React de-duplication`)
    }

    if (resolvedReactPath) {
      outputDebug(`Deduplicating React dependency for ${resolveDir}, using ${resolvedReactPath}`)
      plugins.push(deduplicateReactPlugin(resolvedReactPath))
    }
  }

  return plugins
}

function deduplicateReactPlugin(resolvedReactPath: string): Plugin {
  return {
    name: 'shopify:deduplicate-react',
    setup({onResolve}) {
      onResolve({filter: /^react$/}, (_args) => {
        return {
          path: resolvedReactPath,
        }
      })
    },
  }
}
