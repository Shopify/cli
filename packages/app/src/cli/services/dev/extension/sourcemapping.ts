import {SourceMapConsumer} from 'source-map'
import fs from 'fs'

// this is the source map location of my test extension, update to dynamically select source maps
const sourcemapPath =
  '/Users/henrystelle/test-extensions/matrix-mangoes/extensions/pos-ui-smart-grid/dist/pos-ui-smart-grid.js.map'

let consumer: SourceMapConsumer | null = null

export const getConsumer = () => consumer

// todo: need to re-init whenever the sourcemap changes
export async function initSourcemapConsumer() {
  const sourcemap = fs.readFileSync(sourcemapPath, 'utf8')

  consumer = await new SourceMapConsumer(sourcemap)
}
