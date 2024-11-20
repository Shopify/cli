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
      const contexts: BuildContext[] = []
      const mainOutputPath = extension.getOutputPathForDirectory(this.outputPath)
      const esbuildOptions = await this.extensionEsBuildOptions(
        {
          contents: main,
          resolveDir: extension.directory,
          loader: 'tsx',
        },
        mainOutputPath,
      )
      const context = await esContext(esbuildOptions)
      contexts.push(context)

      if (assets) {
        await Promise.all(
          assets.map(async (asset) => {
            const esbuildOptions = await this.extensionEsBuildOptions(
              {
                contents: asset.content,
                resolveDir: extension.directory,
                loader: 'ts',
              },
              joinPath(dirname(mainOutputPath), asset.outputFileName),
            )
            const context = await esContext(esbuildOptions)
            contexts.push(context)
          }),
        )
      }
      this.contexts[extension.handle] = contexts
    })

    await Promise.all(promises)
  }

  async rebuildContext(extension: ExtensionInstance) {
    const context = this.contexts[extension.handle]
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

  async updateContexts(appEvent: AppEvent) {
    this.dotEnvVariables = appEvent.app.dotenv?.variables ?? {}
    const createdEsBuild = appEvent.extensionEvents
      .filter((extEvent) => extEvent.type === EventType.Created && extEvent.extension.isESBuildExtension)
      .map((extEvent) => extEvent.extension)
    await this.createContexts(createdEsBuild)

    const deletedEsBuild = appEvent.extensionEvents
      .filter((extEvent) => extEvent.type === EventType.Deleted && extEvent.extension.isESBuildExtension)
      .map((extEvent) => extEvent.extension)
    await this.deleteContexts(deletedEsBuild)
  }

  async deleteContexts(extensions: ExtensionInstance[]) {
    const promises = extensions.map((ext) => this.contexts[ext.handle]?.map((context) => context.dispose())).flat()
    await Promise.all(promises)
    extensions.forEach((ext) => {
      const {[ext.handle]: _, ...rest} = this.contexts
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
