import buildHome from './home'
import buildExtension from './build/extension'

import {App} from '../models/app/app'
import {path, output} from '@shopify/cli-kit'

interface BuildOptions {
  app: App
}

async function build({app}: BuildOptions) {
  await Promise.all([
    output.concurrent(0, 'home', async (stdout) => {
      await buildHome('build', {home: app.home, stdout})
    }),
    ...app.extensions.map((extension, index) => {
      return output.concurrent(index + 1, path.basename(extension.directory), async (stdout) => {
        await buildExtension(extension, {stdout})
      })
    }),
  ])
  output.success('Application successfully built')
}

export default build
