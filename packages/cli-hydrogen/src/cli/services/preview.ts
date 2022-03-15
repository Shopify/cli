import {output, path} from '@shopify/cli-kit'

import {MiniOxygen} from '../commands/hydrogen/preview/mini-oxygen/core'

interface PreviewOptions {
  directory: string
  port: number
}

async function preview({directory, port}: PreviewOptions) {
  await runPreview({directory, port})
}

async function runPreview({directory, port}: PreviewOptions) {
  const files = await path.glob('dist/client/**/*')

  const mf = new MiniOxygen({
    buildCommand: 'yarn build',
    globals: {Oxygen: {}},
    scriptPath: path.resolve(directory, 'dist/worker/index.js'),
    sitePath: path.resolve(directory, 'dist/client'),
  })

  const app = await mf.createServer({assets: files})

  app.listen(port, () => {
    output.message(`\nStarted miniOxygen server. Listening at http://localhost:${port}\n`)
  })
}

export default preview
