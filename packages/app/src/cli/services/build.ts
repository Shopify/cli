import {buildExtension} from './build/extension'
import buildHome from './home'
import {App, Home} from '../models/app/app'
import {path, output} from '@shopify/cli-kit'
import {Writable} from 'node:stream'

interface BuildOptions {
  app: App
}

async function build({app}: BuildOptions) {
  await output.concurrent([
    ...app.homes.map((home: Home) => {
      return {
        prefix: home.configuration.type,
        action: async (stdout: Writable, stderr: Writable, signal: AbortSignal) => {
          await buildHome('build', {home, stdout, stderr, signal})
        },
      }
    }),
    ...app.extensions.map((extension) => ({
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
