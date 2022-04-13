import {MiniOxygen} from '../commands/hydrogen/preview/mini-oxygen/core'
import {output, path} from '@shopify/cli-kit'

interface PreviewOptions {
  directory: string
  port: number
}

async function preview({directory, port}: PreviewOptions) {
  await runPreview({directory, port})
}

async function runPreview({directory, port}: PreviewOptions) {
  const files = await path.glob(path.join(directory, 'dist/client/**/*'))

  const mf = new MiniOxygen({
    modules: true,
    buildCommand: 'yarn build',
    globals: {Oxygen: {}},
    scriptPath: path.resolve(directory, 'dist/worker/index.js'),
    sitePath: path.resolve(directory, 'dist/client'),
  })

  const app = await mf.createServer({root: directory, assets: files})

  app.listen(port, () => {
    output.info(`\nStarted miniOxygen server. Listening at http://localhost:${port}\n`)
  })
}

export default preview
