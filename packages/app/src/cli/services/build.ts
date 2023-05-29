import buildWeb from './web.js'
import {installAppDependencies} from './dependencies.js'
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

  await renderConcurrent({
    processes: [
      ...options.app.webs.map((web: Web) => {
        const prefixParts = ['web']
        if ('type' in web.configuration) {
          prefixParts.push(web.configuration.type)
        }
        if ('roles' in web.configuration) {
          prefixParts.push(...web.configuration.roles)
        }
        return {
          prefix: prefixParts.join('-'),
          action: async (stdout: Writable, stderr: Writable, signal: AbortSignal) => {
            await buildWeb('build', {web, stdout, stderr, signal, env})
          },
        }
      }),
      ...options.app.allExtensions.map((ext) => {
        return {
          prefix: ext.localIdentifier,
          action: async (stdout: Writable, stderr: Writable, signal: AbortSignal) => {
            await ext.build({stdout, stderr, signal, app: options.app})
          },
        }
      }),
    ],
    showTimestamps: false,
  })

  renderSuccess({headline: [{userInput: options.app.name}, 'built!']})
}

export default build
