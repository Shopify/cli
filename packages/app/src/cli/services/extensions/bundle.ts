import {ExtensionBuildOptions} from '../build/extension.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {themeExtensionFiles} from '../../utilities/extensions/theme.js'
import {EsbuildEnvVarRegex, environmentVariableNames} from '../../constants.js'
import {context as esContext, BuildResult, formatMessagesSync} from 'esbuild'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {copyFile} from '@shopify/cli-kit/node/fs'
import {joinPath, relativePath} from '@shopify/cli-kit/node/path'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {isTruthy} from '@shopify/cli-kit/node/context/utilities'
import {pickBy} from '@shopify/cli-kit/common/object'
import {Writable} from 'stream'
import {createRequire} from 'module'
import type {StdinOptions, build as esBuild, Plugin} from 'esbuild'

const require = createRequire(import.meta.url)

export interface BundleOptions {
  minify: boolean
  env: {[variable: string]: string}
  outputPath: string
  stdin: StdinOptions
  stdout: Writable
  stderr: Writable

  /**
   * When provided, the bundling process keeps running and notifying about changes.
   * When ESBuild detects changes in any of the modules of the graph it re-bundles it
   * and calls this watch function.
   */
  watch?: (result: BuildResult | null) => Promise<void>

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
}

/**
 * Invokes ESBuild with the given options to bundle an extension.
 * @param options - ESBuild options
 * @param processEnv - Environment variables for the running process (not those from .env)
 */
export async function bundleExtension(options: BundleOptions, processEnv = process.env) {
  const esbuildOptions = getESBuildOptions(options, processEnv)
  const context = await esContext(esbuildOptions)
  if (options.watch) {
    await context.watch()
  } else {
    const result = await context.rebuild()
    onResult(result, options)
    await context.dispose()
  }

  if (options.watchSignal) {
    options.watchSignal.addEventListener('abort', async () => {
      await context.dispose()
    })
  }
}

export async function bundleThemeExtension(
  extension: ExtensionInstance,
  options: ExtensionBuildOptions,
): Promise<void> {
  options.stdout.write(`Bundling theme extension ${extension.localIdentifier}...`)
  const files = await themeExtensionFiles(extension)
  let extensionDirectory = extension.directory
  if (extension.configuration.build_directory) {
    extensionDirectory = joinPath(extensionDirectory, extension.configuration.build_directory)
  }

  await Promise.all(
    files.map(function (filepath) {
      const relativePathName = relativePath(extensionDirectory, filepath)
      const outputFile = joinPath(extension.outputPath, relativePathName)
      return copyFile(filepath, outputFile)
    }),
  )
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

function getESBuildOptions(options: BundleOptions, processEnv = process.env): Parameters<typeof esContext>[0] {
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
  if (options.watch) {
    const watch = options.watch
    esbuildOptions.plugins?.push({
      name: 'rebuild-plugin',
      setup(build) {
        build.onEnd(async (result) => {
          onResult(result, options)
          await watch(result)
        })
      },
    })
  }

  if (options.sourceMaps) {
    esbuildOptions.sourcemap = true
    esbuildOptions.sourceRoot = `${options.stdin.resolveDir}/src`
  }
  return esbuildOptions
}

type ESBuildPlugins = Parameters<typeof esContext>[0]['plugins']

/**
 * It returns the plugins that should be used with ESBuild.
 * @returns List of plugins.
 */
function getPlugins(resolveDir: string | undefined, processEnv = process.env): ESBuildPlugins {
  const plugins = []

  if (isGraphqlPackageAvailable()) {
    const {default: graphqlLoader} = require('@luckycatfactory/esbuild-graphql-loader')
    plugins.push(graphqlLoader())
  }

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
      onResolve({filter: /^react$/}, (args) => {
        return {
          path: resolvedReactPath,
        }
      })
    },
  }
}

/**
 * Returns true if the "graphql" and "graphql-tag" packages can be
 * resolved. This information is used to determine whether we should
 * or not include the esbuild-graphql-loader plugin when invoking ESBuild
 * @returns Returns true if the "graphql" and "graphql-tag" can be resolved.
 */
function isGraphqlPackageAvailable(): boolean {
  try {
    // eslint-disable-next-line @babel/no-unused-expressions
    require.resolve('graphql') && require.resolve('graphql-tag')
    return true
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return false
  }
}
