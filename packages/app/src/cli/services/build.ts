import buildWeb from './web.js'
import {installAppDependencies} from './dependencies.js'
import {installBuildTools} from './function/build.js'
import {AppInterface, Web} from '../models/app/app.js'
import {renderConcurrent, renderSuccess} from '@shopify/cli-kit/node/ui'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {Writable} from 'stream'

interface BuildOptions {
  app: AppInterface
  skipDependenciesInstallation: boolean
  apiKey?: string
}

async function build(options: BuildOptions) {
  if (!options.skipDependenciesInstallation && !options.app.usesWorkspaces) {
    await installAppDependencies(options.app)
  }

  const env: {SHOPIFY_API_KEY?: string} = {}
  if (options.apiKey) {
    env.SHOPIFY_API_KEY = options.apiKey
  }

  // Force the download of the build tool binaries in advance to avoid later problems,
  // as it might be done multiple times in parallel. https://github.com/Shopify/cli/issues/2877
  await installBuildTools(options.app)

  await renderConcurrent({
    processes: [
      ...options.app.webs.map((web: Web) => {
        return {
          prefix: ['web', ...web.configuration.roles].join('-'),
          action: async (stdout: Writable, stderr: Writable, signal: AbortSignal) => {
            await buildWeb('build', {web, stdout, stderr, signal, env})
          },
        }
      }),
      ...options.app.allExtensions.map((ext) => {
        return {
          prefix: ext.localIdentifier,
          action: async (stdout: Writable, stderr: Writable, signal: AbortSignal) => {
            await ext.build({stdout, stderr, signal, app: options.app, environment: 'production'})
          },
        }
      }),
    ],
    showTimestamps: false,
  })

  renderSuccess({headline: [{userInput: options.app.name}, 'built!']})
}

export default build
