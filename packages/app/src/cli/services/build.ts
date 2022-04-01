import buildHome from './home'
import buildExtension from './build/extension'

import {App} from '../models/app/app'
import {path, output} from '@shopify/cli-kit'

interface BuildOptions {
  app: App
}

async function build({app}: BuildOptions) {
  await Promise.all([
    output.concurrent(0, 'home', async (stdout, stderr) => {
      await buildHome('build', {home: app.home, stdout, stderr})
    }),
    ...app.extensions.map((extension, index) => {
      return output.concurrent(index + 1, path.basename(extension.directory), async (stdout, stderr) => {
        await buildExtension(extension, {stdout, stderr})
      })
    }),
  ])
  output.success(`${app.configuration.name} built`)
}

export default build
