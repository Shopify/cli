import {AppEvent, EventType} from './app-event-watcher.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {getESBuildOptions} from '../../extensions/bundle.js'
import {BuildContext, context as esContext} from 'esbuild'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {copyFile} from '@shopify/cli-kit/node/fs'
import {dirname} from '@shopify/cli-kit/node/path'

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
  contexts: {[key: string]: BuildContext}
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
      const allDispose = Object.values(this.contexts).map((context) => context.dispose())
      await Promise.all(allDispose)
    })
  }

  async createContexts(extensions: ExtensionInstance[]) {
    const promises = extensions.map(async (extension) => {
      const esbuildOptions = getESBuildOptions({
        minify: false,
        outputPath: extension.getOutputPathForDirectory(this.outputPath),
        environment: 'development',
        env: {
          ...this.dotEnvVariables,
          APP_URL: this.url,
        },
        stdin: {
          contents: extension.getBundleExtensionStdinContent(),
          resolveDir: extension.directory,
          loader: 'tsx',
        },
        logLevel: 'silent',
        // stdout and stderr are mandatory, but not actually used
        stderr: process.stderr,
        stdout: process.stdout,
        sourceMaps: true,
      })

      const context = await esContext(esbuildOptions)
      this.contexts[extension.handle] = context
    })

    await Promise.all(promises)
  }

  async rebuildContext(extension: ExtensionInstance) {
    const context = this.contexts[extension.handle]
    if (!context) return
    await context.rebuild()

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
    const promises = extensions.map((ext) => this.contexts[ext.handle]?.dispose())
    await Promise.all(promises)
    extensions.forEach((ext) => {
      const {[ext.handle]: _, ...rest} = this.contexts
      this.contexts = rest
    })
  }
}
