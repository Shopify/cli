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

    await run(options.argv, config)
    await flush()
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    const {errorHandler} = await import('./error-handler.js')
    await errorHandler(error as Error)
    return Errors.handle(error as Error)
  }
}
