import {buildExtension} from './build/extension'
import buildWeb from './web'
import {App, Web} from '../models/app/app'
import {path, output} from '@shopify/cli-kit'
import {Writable} from 'node:stream'

interface BuildOptions {
  app: App
}

async function build({app}: BuildOptions) {
  await output.concurrent([
    ...app.webs.map((web: Web) => {
      return {
        prefix: web.configuration.type,
        action: async (stdout: Writable, stderr: Writable, signal: AbortSignal) => {
          await buildWeb('build', {web, stdout, stderr, signal})
        },
      }
    }),
    ...app.extensions.ui.map((extension) => ({
      prefix: path.basename(extension.directory),
      action: async (stdout: Writable, stderr: Writable, signal: AbortSignal) => {
        await buildExtension({app, extension, stdout, stderr, signal})
      },
    })),
  ])

  output.newline()
  output.success(`${app.configuration.name} built`)
}

export default build
