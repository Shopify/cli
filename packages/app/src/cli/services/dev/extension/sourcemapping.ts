import {BasicSourceMapConsumer, IndexedSourceMapConsumer, SourceMapConsumer} from 'source-map'
import fs from 'fs'

let consumer: BasicSourceMapConsumer | IndexedSourceMapConsumer | null = null

export const getConsumer = () => consumer

export async function initSourcemapConsumer() {
  // this is the source map location of my test extension, update to dynamically select source maps
  const sourcemapPath =
    '/Users/henrystelle/test-extensions/matrix-mangoes/extensions/pos-ui-smart-grid/dist/pos-ui-smart-grid.js.map'

  const sourcemap = fs.readFileSync(sourcemapPath, 'utf8')

  consumer = await new SourceMapConsumer(sourcemap)
}
