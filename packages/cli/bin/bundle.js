import {build as esBuild} from 'esbuild'
import cleanBundledDependencies from '../../../bin/clean-bundled-dependencies.js'
import replace from 'esbuild-plugin-replace'

const external = [
  'react-devtools-core',  // react-devtools-core can't be bundled (part of ink)
  'yoga-wasm-web', // yoga-wasm-web can't be bundled (part of ink)
  'esbuild',
  '@luckycatfactory/esbuild-graphql-loader',
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
    replace({
      'nodeRequire (': 'module.require('
    })
  ],
})

await cleanBundledDependencies(external)
