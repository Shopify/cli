<<<<<<< HEAD
import {buildThemeExtensions, buildUIExtensions} from './build/extension'
=======
import {buildUIExtensions, buildFunctionExtension} from './build/extension'
>>>>>>> 0b86650f (Add support for building functions)
import buildWeb from './web'
import {installAppDependencies} from './dependencies'
import {App, Web} from '../models/app/app'
import {error, output} from '@shopify/cli-kit'
import {Writable} from 'node:stream'

interface BuildOptions {
  app: App
  skipDependenciesInstallation: boolean
}

async function build({app, skipDependenciesInstallation}: BuildOptions) {
  if (!skipDependenciesInstallation) {
    await installAppDependencies(app)
  }
  await output.concurrent([
    ...app.webs.map((web: Web) => {
      return {
        prefix: web.configuration.type,
        action: async (stdout: Writable, stderr: Writable, signal: error.AbortSignal) => {
          await buildWeb('build', {web, stdout, stderr, signal})
        },
      }
    }),
    {
<<<<<<< HEAD
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
      prefix: 'ui_extensions',
      action: async (stdout: Writable, stderr: Writable, signal: error.AbortSignal) => {
        await buildUIExtensions({
          app,
          extensions: app.extensions.ui,
          stdout,
          stderr,
          signal,
        })
=======
      prefix: 'ui-extensions',
      action: async (stdout: Writable, stderr: Writable, signal: error.AbortSignal) => {
        await buildUIExtensions({app, extensions: app.extensions.ui, stdout, stderr, signal})
>>>>>>> 0b86650f (Add support for building functions)
      },
    },
    ...app.extensions.function.map((functionExtension) => {
      return {
        prefix: functionExtension.localIdentifier,
        action: async (stdout: Writable, stderr: Writable, signal: error.AbortSignal) => {
          await buildFunctionExtension(functionExtension, {stdout, stderr, signal})
        },
      }
    }),
  ])

  output.newline()
  output.success(`${app.name} built`)
}

export default build
