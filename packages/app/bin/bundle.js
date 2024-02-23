import {build as esBuild} from 'esbuild'
import cleanBundledDependencies from '../../../bin/clean-bundled-dependencies.js'

const external =[
  '@shopify/plugin-cloudflare', // Plugins need to be external so that they can be loaded dynamically
  'esbuild', // esbuild can't be bundled
  '@luckycatfactory/esbuild-graphql-loader', // esbuild plugin, can't be bundled
]

await esBuild({
  bundle: true,
  entryPoints: ['./src/**/*.ts'],
  outdir: './dist/cli',
  platform: 'node',
  format: 'esm',
  inject: ['../../bin/cjs-shims.js'],
  external,
  loader: {'.node': 'copy'},
  splitting: true,
  plugins: [],
})

await cleanBundledDependencies(external)
