import {buildThemeExtensions, buildFunctionExtension, buildUIExtensions} from './build/extension.js'
import buildWeb from './web.js'
import {installAppDependencies} from './dependencies.js'
import {AppInterface, Web} from '../models/app/app.js'
import {abort} from '@shopify/cli-kit'
import {renderConcurrent, renderSuccess} from '@shopify/cli-kit/node/ui'
import {Writable} from 'node:stream'

interface BuildOptions {
  app: AppInterface
  skipDependenciesInstallation: boolean
  apiKey?: string
}

async function build(options: BuildOptions) {
  if (!options.skipDependenciesInstallation) {
    await installAppDependencies(options.app)
  }

  const env: {SHOPIFY_API_KEY?: string} = {}
  if (options.apiKey) {
    env.SHOPIFY_API_KEY = options.apiKey
  }

  await renderConcurrent({
    processes: [
      ...options.app.webs.map((web: Web) => {
        return {
          prefix: web.configuration.type,
          action: async (stdout: Writable, stderr: Writable, signal: abort.Signal) => {
            await buildWeb('build', {web, stdout, stderr, signal, env})
          },
        }
      }),
      {
        prefix: 'theme_extensions',
        action: async (stdout: Writable, stderr: Writable, signal: abort.Signal) => {
          await buildThemeExtensions({
            app: options.app,
            extensions: options.app.extensions.theme,
            stdout,
            stderr,
            signal,
          })
        },
      },
      ...(await buildUIExtensions({app: options.app})),
      ...options.app.extensions.function.map((functionExtension) => {
        return {
          prefix: functionExtension.localIdentifier,
          action: async (stdout: Writable, stderr: Writable, signal: abort.Signal) => {
            await buildFunctionExtension(functionExtension, {stdout, stderr, signal, app: options.app})
          },
        }
      }),
    ],
    showTimestamps: false,
  })

  renderSuccess({headline: `${options.app.name} built!`})
}

export default build
