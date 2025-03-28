import {AppEvent, EventType} from './app-event-watcher.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {getESBuildOptions} from '../../extensions/bundle.js'
import {BuildContext, context as esContext, StdinOptions} from 'esbuild'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {copyFile} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'

export interface DevAppWatcherOptions {
  dotEnvVariables: {[key: string]: string}
  url: string
  outputPath: string
}

/**
 * Class to manage the ESBuild contexts for the app watcher.
 * Has a list of all active contexts and methods to create, update and delete them.
 */
export class ESBuildContextManager {
  contexts: {[key: string]: BuildContext[]}
  outputPath: string
  dotEnvVariables: {[key: string]: string}
  url: string
  signal?: AbortSignal

  constructor(options: DevAppWatcherOptions) {
    this.dotEnvVariables = options.dotEnvVariables
    this.url = options.url
    this.outputPath = options.outputPath
    this.contexts = {}
  }

  setAbortSignal(signal: AbortSignal) {
    this.signal = signal
    this.signal?.addEventListener('abort', async () => {
      const allDispose = Object.values(this.contexts)
        .map((context) => context.map((ctxt) => ctxt.dispose()))
        .flat()
      await Promise.all(allDispose)
    })
  }

  async createContexts(extensions: ExtensionInstance[]) {
    const promises = extensions.map(async (extension) => {
      const {main, assets} = extension.getBundleExtensionStdinContent()
      const mainOutputPath = extension.getOutputPathForDirectory(this.outputPath)
      const esbuildOptions = await this.extensionEsBuildOptions(
        {
          contents: main,
          resolveDir: extension.directory,
          loader: 'tsx',
        },
        mainOutputPath,
      )
      const mainContextPromise = esContext(esbuildOptions)

      const assetContextPromises = (assets ?? []).map(async (asset) => {
        const esbuildOptions = await this.extensionEsBuildOptions(
          {
            contents: asset.content,
            resolveDir: extension.directory,
            loader: 'ts',
          },
          joinPath(dirname(mainOutputPath), asset.outputFileName),
        )
        return esContext(esbuildOptions)
      })

      this.contexts[extension.uid] = await Promise.all(assetContextPromises.concat(mainContextPromise))
    })

    await Promise.all(promises)
  }

  async rebuildContext(extension: ExtensionInstance) {
    const context = this.contexts[extension.uid]
    if (!context) return
    await Promise.all(context.map((ctxt) => ctxt.rebuild()))

    // The default output path for a extension is now inside `.shopify/bundle/<ext_id>/dist`,
    // all extensions output need to be under the same directory so that it can all be zipped together.

    // But historically the output was inside each extension's directory.
    // To avoid breaking flows that depend on this, we copy the output to the old location.
    // This also makes it easier to access sourcemaps or other built artifacts.
    const outputPath = dirname(extension.getOutputPathForDirectory(this.outputPath))
    const copyPath = dirname(extension.outputPath)
    await copyFile(outputPath, copyPath)
  }

  /**
   * New contexts are created for new extensions that were added during a dev session.
   * We also need to recreate contexts for UI extensions whose TOML files were updated.
   * This is because some changes in the TOML invalidate the current context (changing targets or handle for example)
   */
  async updateContexts(appEvent: AppEvent) {
    this.dotEnvVariables = appEvent.app.dotenv?.variables ?? {}

    const createdEsBuild = appEvent.extensionEvents
      .filter((extEvent) => extEvent.extension.isESBuildExtension)
      .filter((extEvent) => extEvent.type === 'created' || (extEvent.type === 'changed' && appEvent.appWasReloaded))
      .map((extEvent) => extEvent.extension)
    await this.createContexts(createdEsBuild)

    const deletedEsBuild = appEvent.extensionEvents
      .filter((extEvent) => extEvent.type === EventType.Deleted && extEvent.extension.isESBuildExtension)
      .map((extEvent) => extEvent.extension)
    await this.deleteContexts(deletedEsBuild)
  }

  async deleteContexts(extensions: ExtensionInstance[]) {
    const promises = extensions.map((ext) => this.contexts[ext.uid]?.map((context) => context.dispose())).flat()
    await Promise.all(promises)
    extensions.forEach((ext) => {
      const {[ext.uid]: _, ...rest} = this.contexts
      this.contexts = rest
    })
  }

  private async extensionEsBuildOptions(stdin: StdinOptions, outputPath: string) {
    return getESBuildOptions({
      minify: false,
      outputPath,
      environment: 'development',
      env: {
        ...this.dotEnvVariables,
        APP_URL: this.url,
      },
      stdin,
      logLevel: 'silent',
      // stdout and stderr are mandatory, but not actually used
      stderr: process.stderr,
      stdout: process.stdout,
      sourceMaps: true,
    })
  }
}
