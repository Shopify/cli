import {isTruthy} from './context/utilities.js'
import {fileURLToPath} from 'node:url'
import type {LazyCommandLoader} from './custom-oclif-loader.js'

interface Options {
  moduleURL: string
  argv?: string[]
  lazyCommandLoader?: LazyCommandLoader
}

/**
 * Launches the CLI.
 *
 * @param options - Options.
 * @returns A promise that resolves when the CLI has been launched.
 */
export async function launchCLI(options: Options): Promise<void> {
  const {isDevelopment} = await import('./context/local.js')
  const {ShopifyConfig} = await import('./custom-oclif-loader.js')
  type OclifCore = typeof import('@oclif/core')
  const oclifModule = await import('@oclif/core')
  // esbuild wraps CJS dynamic imports under .default when bundling as ESM with code splitting
  const {run, flush, Errors, settings}: OclifCore =
    (oclifModule as OclifCore & {default?: OclifCore}).default ?? oclifModule

  if (isDevelopment()) {
    settings.debug = true
  }

  try {
    const config = new ShopifyConfig({root: fileURLToPath(options.moduleURL)})
    await config.load()

    if (options.lazyCommandLoader) {
      config.setLazyCommandLoader(options.lazyCommandLoader)
    }

    const argv = options.argv ?? process.argv.slice(2)
    const passthroughIndex = argv.indexOf('--')
    const commandArguments = passthroughIndex === -1 ? argv : argv.slice(0, passthroughIndex)
    if (commandArguments.includes('--json-schema') || isTruthy(process.env.SHOPIFY_FLAG_JSON_SCHEMA)) {
      // Inspect the command before Oclif runs init or prerun hooks, which may require a project or start background work.
      const {printCommandJsonSchema} = await import('../../private/node/command-json-schema.js')
      await printCommandJsonSchema(config, argv, options.lazyCommandLoader)
      return
    }

    await run(argv, config)
    await flush()
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    const {errorHandler} = await import('./error-handler.js')
    await errorHandler(error as Error)
    return Errors.handle(error as Error)
  }
}
