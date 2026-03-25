import {fileURLToPath} from 'node:url'

interface Options {
  moduleURL: string
  argv?: string[]
}

/**
 * Launches the CLI.
 *
 * @param options - Options.
 * @returns A promise that resolves when the CLI has been launched.
 */
export async function launchCLI(options: Options): Promise<void> {
  const {errorHandler} = await import('./error-handler.js')
  const {isDevelopment} = await import('./context/local.js')
  type OclifCore = typeof import('@oclif/core')
  const oclifModule = await import('@oclif/core')
  // esbuild wraps CJS dynamic imports under .default when bundling as ESM with code splitting
  const {Config, run, flush, Errors, settings}: OclifCore =
    (oclifModule as OclifCore & {default?: OclifCore}).default ?? oclifModule

  if (isDevelopment()) {
    settings.debug = true
  }

  try {
    const config = new Config({root: fileURLToPath(options.moduleURL)})
    await config.load()

    await run(options.argv, config)
    await flush()
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    await errorHandler(error as Error)
    return Errors.handle(error as Error)
  }
}
