import {build as esBuild} from 'esbuild'
import cleanBundledDependencies from '../../../bin/clean-bundled-dependencies.js'

const external = [
  'react-devtools-core',  // react-devtools-core can't be bundled
  'yoga-wasm-web', // yoga-wasm-web can't be bundled
  'esbuild', // esbuild can't be bundled
  'stacktracey',
  'react'
]

await esBuild({
  bundle: true,
  entryPoints: ['./src/**/*.ts','./src/**/*.tsx'],
  outdir: './dist',
  platform: 'node',
  format: 'esm',
  inject: ['../../bin/cjs-shims.js'],
  external,
  loader: {'.node': 'copy'},
  splitting: true,
  plugins: [],
})

await cleanBundledDependencies(external)
