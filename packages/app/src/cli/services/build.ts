import {buildThemeExtensions, buildUIExtensions, buildFunctionExtension} from './build/extension.js'
import buildWeb from './web.js'
import {installAppDependencies} from './dependencies.js'
import {AppInterface, Web} from '../models/app/app.js'
import {error, output} from '@shopify/cli-kit'
import {Writable} from 'node:stream'

interface BuildOptions {
  app: AppInterface
  skipDependenciesInstallation: boolean
  apiKey?: string
}

async function build({app, skipDependenciesInstallation, apiKey = undefined}: BuildOptions) {
  if (!skipDependenciesInstallation) {
    await installAppDependencies(app)
  }

  const env: {SHOPIFY_API_KEY?: string} = {}
  if (apiKey) {
    env.SHOPIFY_API_KEY = apiKey
  }

  await output.concurrent([
    ...app.webs.map((web: Web) => {
      return {
        prefix: web.configuration.type,
        action: async (stdout: Writable, stderr: Writable, signal: error.AbortSignal) => {
          await buildWeb('build', {web, stdout, stderr, signal, env})
        },
      }
    }),
    {
      prefix: 'theme_extensions',
      action: async (stdout: Writable, stderr: Writable, signal: error.AbortSignal) => {
        await buildThemeExtensions({
          app,
          extensions: app.extensions.theme,
          stdout,
          stderr,
          signal,
        })
      },
    },
    {
      prefix: 'extensions',
      action: async (stdout: Writable, stderr: Writable, signal: error.AbortSignal) => {
        await buildUIExtensions({
          app,
          extensions: app.extensions.ui,
          stdout,
          stderr,
          signal,
        })
      },
    },
    ...app.extensions.function.map((functionExtension) => {
      return {
        prefix: functionExtension.localIdentifier,
        action: async (stdout: Writable, stderr: Writable, signal: error.AbortSignal) => {
          await buildFunctionExtension(functionExtension, {stdout, stderr, signal, app})
        },
      }
    }),
  ])

  output.newline()
  output.success(`${app.name} built`)
}

export default build
