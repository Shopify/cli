import {buildExtension} from './build/extension'
import buildHome from './home'
import {App, Home} from '../models/app/app'
import {path, output} from '@shopify/cli-kit'
import {Writable} from 'node:stream'

interface BuildOptions {
  app: App
}

async function build({app}: BuildOptions) {
  const abortController = new AbortController()
  try {
    await output.concurrent([
      ...app.homes.map((home: Home) => {
        return {
          prefix: home.configuration.type,
          action: async (stdout: Writable, stderr: Writable) => {
            await buildHome('build', {home, stdout, stderr, signal: abortController.signal})
          },
        }
      }),
      ...app.extensions.map((extension) => ({
        prefix: path.basename(extension.directory),
        action: async (stdout: Writable, stderr: Writable) => {
          await buildExtension(extension, {stdout, stderr, signal: abortController.signal})
        },
      })),
    ])
  } catch (error: any) {
    // If one of the processes fails, we abort any running ones.
    abortController.abort()
    throw error
  }

  output.newline()
  output.success(`${app.configuration.name} built`)
}

export default build
