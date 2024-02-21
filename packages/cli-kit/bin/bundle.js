import {build as esBuild} from 'esbuild'
import cleanBundledDependencies from '../../../bin/clean-bundled-dependencies.js'

const external = ['react-devtools-core', 'yoga-wasm-web', 'shelljs', 'esbuild', 'react', 'ink', 'stacktracey']

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
