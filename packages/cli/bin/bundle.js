import {build as esBuild} from 'esbuild'
import cleanBundledDependencies from '../../../bin/clean-bundled-dependencies.js'

const external = [
  '@shopify/cli-kit',
  '@shopify/app',
  '@shopify/theme',
  'shelljs'
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
  plugins: [],
})

await cleanBundledDependencies(external)
