import buildHome from './home'
import buildExtension from './build/extension'

import {App} from '../models/app/app'
import {path, output} from '@shopify/cli-kit'
import {Writable} from 'stream'

interface BuildOptions {
  app: App
}

async function build({app}: BuildOptions) {
  await Promise.all([
    buildBlock(0, 'home', async (stdout) => {
      await buildHome('build', {home: app.home, stdout})
    }),
    ...app.extensions.map((extension, index) => {
      return buildBlock(index + 1, path.basename(extension.directory), async (stdout) => {
        await buildExtension(extension, {stdout})
      })
    }),
  ])
  output.success('Application successfully built')
}

async function buildBlock(index: number, prefix: string, process: (stdout: Writable) => Promise<void>) {
  const stdout = new Writable({
    write(chunk, encoding, next) {
      const lines = chunk.toString('ascii').split('\n')
      const linePrefix = getColor(index)(`[${prefix}]: `)
      for (const line of lines) {
        output.info(output.content`${linePrefix}${line}`)
      }
      next()
    },
  })
  await process(stdout)
}

function getColor(index: number) {
  const colorFunctions = [output.token.yellow, output.token.cyan, output.token.magenta]
  return colorFunctions[index]
}

export default build
