import {build as esBuild} from 'esbuild'

await esBuild({
  bundle: true,
  entryPoints: ['./src/**/*.ts'],
  outdir: './dist/cli',
  platform: 'node',
  format: 'esm',
  inject: ['../../bin/cjs-shims.js'],
  external: ['@shopify/cli-kit', '@oclif/core'],

  loader: {'.node': 'copy'},
  splitting: true,
  plugins: [],
})
