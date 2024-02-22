import {build as esBuild} from 'esbuild'
import cleanBundledDependencies from '../../../bin/clean-bundled-dependencies.js'

const external =[
  'react-devtools-core',
  'yoga-wasm-web',
  '@shopify/cli-kit',
  'react',
  'esbuild',
  '@shopify/plugin-cloudflare',
  '@luckycatfactory/esbuild-graphql-loader'
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
