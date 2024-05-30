import {ExtensionBuildOptions} from '../build/extension.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {themeExtensionFiles} from '../../utilities/extensions/theme.js'
import {EsbuildEnvVarRegex, environmentVariableNames} from '../../constants.js'
import {flowTemplateExtensionFiles} from '../../utilities/extensions/flow-template.js'
import {context as esContext, BuildResult, formatMessagesSync} from 'esbuild'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {copyFile, mkdir, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {basename, dirname, joinPath, relativePath} from '@shopify/cli-kit/node/path'
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

interface FlowTemplateLocalization {
  /**
   * The default language the template is displayed in.
   */
  default_locale: string
  /**
   * A hash of language codes to the base64 encoded content of the translation file.
   */
  translations: {[key: string]: string}
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

  await Promise.all(
    files.map(function (filepath) {
      const relativePathName = relativePath(extension.directory, filepath)
      const outputFile = joinPath(extension.outputPath, relativePathName)
      return copyFile(filepath, outputFile)
    }),
  )
}

export async function bundleFlowTemplateExtension(extension: ExtensionInstance): Promise<void> {
  const files = await flowTemplateExtensionFiles(extension)
  const localizationObject: FlowTemplateLocalization = {
    default_locale: '',
    translations: {},
  }

  await Promise.all(files.map((filepath) => processFlowTemplateFile(filepath, extension, localizationObject)))

  const localizationFile = joinPath(extension.outputPath, 'localization.json')
  const localizationContent = JSON.stringify(localizationObject)
  await writeFile(localizationFile, localizationContent)
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

async function processFlowTemplateFile(
  filepath: string,
  extension: ExtensionInstance,
  localizationObject: FlowTemplateLocalization,
): Promise<void> {
  const content = await readFile(filepath)
  // whatever is the file, encode its content as base64
  const encodedContent = Buffer.from(content).toString('base64')

  // if it's the definition file, copy it to the output directory to be uploaded to the gcs
  if (filepath.endsWith('.flow')) {
    const relativePathName = relativePath(extension.directory, filepath)
    const outputFile = joinPath(extension.outputPath, relativePathName)
    await ensureDirectoryExists(outputFile)
    await writeFile(outputFile, encodedContent)
  } else if (filepath.endsWith('.json')) {
    return processFlowLocalizationFile(filepath, encodedContent, localizationObject)
  }
}

async function ensureDirectoryExists(filePath: string): Promise<void> {
  const directory = dirname(filePath)
  await mkdir(directory)
}

async function processFlowLocalizationFile(
  filepath: string,
  encodedContent: string,
  localizationObject: FlowTemplateLocalization,
): Promise<void> {
  const locale = basename(filepath, '.json')
  const isDefault = locale.endsWith('.default')
  const localeKey = isDefault ? locale.replace('.default', '') : locale

  if (isDefault) {
    localizationObject.default_locale = localeKey
  }
  localizationObject.translations[localeKey] = encodedContent
}
