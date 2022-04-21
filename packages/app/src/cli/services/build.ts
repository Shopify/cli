import buildHome from './home'
import {buildExtension} from './build/extension'

import {App} from '../models/app/app'
import {path, output} from '@shopify/cli-kit'
import {Writable} from 'node:stream'

interface BuildOptions {
  app: App
}

async function build({app}: BuildOptions) {
  const abortController = new AbortController()
  try {
    await output.concurrent([
      {
        prefix: 'home',
        action: async (stdout, stderr) => {
          await buildHome('build', {home: app.home, stdout, stderr, signal: abortController.signal})
        },
      },
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

  output.success(`${app.configuration.name} built`)
}

export default build
