import {fileURLToPath} from 'node:url'
import type {LazyCommandLoader} from './custom-oclif-loader.js'

interface Options {
  moduleURL: string
  argv?: string[]
  lazyCommandLoader?: LazyCommandLoader
}

/**
 * Launches the CLI through our custom OCLIF loader.
 *
 * @param options - Options.
 * @returns A promise that resolves when the CLI has been launched.
 */
export async function launchCLI(options: Options): Promise<void> {
  const {isDevelopment} = await import('./context/local.js')
  const oclif = await import('@oclif/core')
  const {ShopifyConfig} = await import('./custom-oclif-loader.js')

  if (isDevelopment()) {
    oclif.default.settings.debug = true
  }

  try {
    // Use a custom OCLIF config to customize the behavior of the CLI
    const config = new ShopifyConfig({root: fileURLToPath(options.moduleURL)})
    await config.load()

    // Enable lazy command loading if a loader is provided
    if (options.lazyCommandLoader) {
      config.setLazyCommandLoader(options.lazyCommandLoader)
    }

    await oclif.default.run(options.argv, config)
    await oclif.default.flush()
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    // Defer error-handler import to the error path (saves ~380ms on happy path)
    const {errorHandler} = await import('./error-handler.js')
    await errorHandler(error as Error)
    return oclif.default.Errors.handle(error as Error)
  }
}
