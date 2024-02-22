import {build as esBuild} from 'esbuild'
import cleanBundledDependencies from '../../../bin/clean-bundled-dependencies.js'

const external =[
  'react-devtools-core',
  'yoga-wasm-web',
  '@shopify/cli-kit',
  'react',
  '@luckycatfactory/esbuild-graphql-loader',
  '@shopify/plugin-cloudflare', // Plugins need to be external so that they can be loaded dynamically
  'esbuild', // esbuild can't be bundled
  'javy-cli' // This needs to be external so that we can invoke it with `npm exec -- javy`
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
