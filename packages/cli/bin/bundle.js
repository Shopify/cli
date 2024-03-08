import {build as esBuild} from 'esbuild'
import cleanBundledDependencies from '../../../bin/clean-bundled-dependencies.js'
import requireResolvePlugin from '@chialab/esbuild-plugin-require-resolve';

const external = [
  'react-devtools-core',  // react-devtools-core can't be bundled (part of ink)
  'yoga-wasm-web', // yoga-wasm-web can't be bundled (part of ink)
  'stacktracey',
  'esbuild',
  '@luckycatfactory/esbuild-graphql-loader',
  'vscode-json-languageservice'
]

await esBuild({
  bundle: true,
  entryPoints: ['./src/**/*.ts'],
  outdir: './dist',
  platform: 'node',
  format: 'esm',
  inject: ['../../bin/cjs-shims.js'],
  external,
  loader: {'.node': 'copy'},
  splitting: true,
  plugins: [
    requireResolvePlugin(),
  ],
})

await cleanBundledDependencies(external)
