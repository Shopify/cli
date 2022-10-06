import {abort, path} from '@shopify/cli-kit'
import {build as esBuild, BuildFailure, BuildResult, formatMessagesSync} from 'esbuild'
import {Writable} from 'node:stream'

interface BundleOptions {
  minify: boolean
  env: {[variable: string]: string}
  outputBundlePath: string
  sourceFilePath: string
  stdout: Writable
  stderr: Writable

  /**
   * When provided, the bundling process keeps running and notifying about changes.
   * When ESBuild detects changes in any of the modules of the graph it re-bundles it
   * and calls this watch function.
   */
  watch?: (error: BuildFailure | null, result: BuildResult | null) => void

  /**
   * This signal allows the caller to stop the watching process.
   */
  watchSignal?: abort.Signal

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
}

/**
 * Invokes ESBuild with the given options to bundle an extension.
 * @param options - ESBuild options
 */
export async function bundleExtension(options: BundleOptions) {
  const esbuildOptions = getESBuildOptions(options)
  const result = await esBuild(esbuildOptions)
  if (options.watchSignal) {
    options.watchSignal.addEventListener('abort', () => {
      if (result.stop) {
        result.stop()
      }
    })
  }
  onResult(result, options)
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

function getESBuildOptions(options: BundleOptions): Parameters<typeof esBuild>[0] {
  const env: {[variable: string]: string} = options.env
  const define = Object.keys(env || {}).reduce(
    (acc, key) => ({
      ...acc,
      [`process.env.${key}`]: JSON.stringify(env[key]),
    }),
    {'process.env.NODE_ENV': JSON.stringify(options.environment)},
  )
  let esbuildOptions: Parameters<typeof esBuild>[0] = {
    entryPoints: [options.sourceFilePath],
    outfile: options.outputBundlePath,
    sourceRoot: path.dirname(options.sourceFilePath),
    bundle: true,
    define,
    jsx: 'automatic',
    loader: {
      '.esnext': 'ts',
      '.js': 'jsx',
    },
    legalComments: 'none',
    minify: options.minify,
    plugins: getPlugins(),
    target: 'es6',
    resolveExtensions: ['.tsx', '.ts', '.js', '.json', '.esnext', '.mjs', '.ejs'],
  }
  if (options.watch) {
    const watch = options.watch
    esbuildOptions = {
      ...esbuildOptions,
      watch: {
        onRebuild: (error, result) => {
          onResult(result, options)
          watch(error, result)
        },
      },
    }
  }
  return esbuildOptions
}

type ESBuildPlugins = Parameters<typeof esBuild>[0]['plugins']

/**
 * It returns the plugins that should be used with ESBuild.
 * @returns List of plugins.
 */
function getPlugins(): ESBuildPlugins {
  const plugins = []

  if (isGraphqlPackageAvailable()) {
    const {default: graphqlLoader} = require('@luckycatfactory/esbuild-graphql-loader')
    plugins.push(graphqlLoader())
  }

  return plugins
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
