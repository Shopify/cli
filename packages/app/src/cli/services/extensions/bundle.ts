import {buildThemeExtensions, ThemeExtensionBuildOptions} from '../build/extension.js'
import {context as esContext, BuildResult, formatMessagesSync} from 'esbuild'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {copyFile, glob} from '@shopify/cli-kit/node/fs'
import {joinPath, relativePath} from '@shopify/cli-kit/node/path'
import {useThemebundling} from '@shopify/cli-kit/node/context/local'
import {Writable} from 'stream'
import {createRequire} from 'module'
import type {StdinOptions, build as esBuild} from 'esbuild'

const require = createRequire(import.meta.url)

export interface BundleOptions {
  minify: boolean
  env: {[variable: string]: string}
  outputBundlePath: string
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
}

/**
 * Invokes ESBuild with the given options to bundle an extension.
 * @param options - ESBuild options
 */
export async function bundleExtension(options: BundleOptions) {
  const esbuildOptions = getESBuildOptions(options)
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

export async function bundleThemeExtensions(options: ThemeExtensionBuildOptions): Promise<void> {
  if (options.extensions.length === 0) return

  await buildThemeExtensions(options)

  if (useThemebundling()) {
    await Promise.all(
      options.extensions.map(async (extension) => {
        options.stdout.write(`Bundling theme extension ${extension.localIdentifier}...`)
        const files = await glob(joinPath(extension.directory, '/**/*'))

        await Promise.all(
          files.map(function (filepath) {
            if (!(filepath.includes('.gitkeep') || filepath.includes('.toml'))) {
              const relativePathName = relativePath(extension.directory, filepath)
              const outputFile = joinPath(extension.outputBundlePath, relativePathName)
              return copyFile(filepath, outputFile)
            }
          }),
        )
      }),
    )
  }
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

function getESBuildOptions(options: BundleOptions): Parameters<typeof esContext>[0] {
  const env: {[variable: string]: string} = options.env
  const define = Object.keys(env || {}).reduce(
    (acc, key) => ({
      ...acc,
      [`process.env.${key}`]: JSON.stringify(env[key]),
    }),
    {'process.env.NODE_ENV': JSON.stringify(options.environment)},
  )
  const esbuildOptions: Parameters<typeof esContext>[0] = {
    outfile: options.outputBundlePath,
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
    plugins: getPlugins(),
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
  return esbuildOptions
}

type ESBuildPlugins = Parameters<typeof esContext>[0]['plugins']

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
