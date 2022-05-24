import {buildExtension} from './build/extension'
import buildWeb from './web'
import {installAppDependencies} from './dependencies'
import {App, Web} from '../models/app/app'
import {path, output} from '@shopify/cli-kit'
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
        action: async (stdout: Writable, stderr: Writable, signal: AbortSignal) => {
          await buildWeb('build', {web, stdout, stderr, signal})
        },
      }
    }),
    {
      prefix: path.basename('extensions'),
      action: async (stdout: Writable, stderr: Writable, signal: AbortSignal) => {
        await buildExtension({app, extensions: app.extensions.ui, stdout, stderr, signal})
      },
    },
  ])

  output.newline()
  output.success(`${app.configuration.name} built`)
}

export default build
