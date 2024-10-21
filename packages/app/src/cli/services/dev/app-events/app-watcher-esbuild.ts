import {AppEvent, EventType} from './app-event-watcher.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {getESBuildOptions} from '../../extensions/bundle.js'
import {BuildContext, BuildOptions, context as esContext} from 'esbuild'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {Writable} from 'stream'

export interface DevAppWatcherOptions {
  dotEnvVariables: {[key: string]: string}
  url: string
  outputPath: string
  stderr?: Writable
  stdout?: Writable
  signal?: AbortSignal
}

/**
 * Class to manage the ESBuild contexts for the app watcher.
 * Has a list of all active contexts and methods to create, update and delete them.
 */
export class ESBuildContextManager {
  contexts: {[key: string]: BuildContext<BuildOptions>}
  outputPath: string
  dotEnvVariables: {[key: string]: string}
  url: string
  stderr?: Writable
  stdout?: Writable
  signal?: AbortSignal

  constructor(options: DevAppWatcherOptions) {
    this.dotEnvVariables = options.dotEnvVariables
    this.url = options.url
    this.outputPath = options.outputPath
    this.stderr = options.stderr
    this.stdout = options.stdout
    this.signal = options.signal
    this.contexts = {}

    options.signal?.addEventListener('abort', async () => {
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
        stderr: this.stderr ?? process.stderr,
        stdout: this.stdout ?? process.stdout,
        sourceMaps: true,
      })

      const context = await esContext(esbuildOptions)
      this.contexts[extension.handle] = context
    })

    await Promise.all(promises)
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
